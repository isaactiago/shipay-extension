const API_BASE = "https://api-staging.shipay.com.br";

const emptyState = document.getElementById("empty-state");
const capturedState = document.getElementById("captured-state");
const txidValueEl = document.getElementById("txid-value");
const payBtn = document.getElementById("pay-btn");
const resultMsg = document.getElementById("result-msg");
const refreshBtn = document.getElementById("refresh-btn");

let currentTxid = null;

function showEmpty(message) {
  currentTxid = null;
  emptyState.textContent = message || "Nenhum QR encontrado nesta aba.";
  emptyState.style.display = "block";
  capturedState.style.display = "none";
}

function showCaptured(txid, alreadyPaid) {
  currentTxid = txid;
  emptyState.style.display = "none";
  capturedState.style.display = "block";
  txidValueEl.textContent = txid;
  resultMsg.textContent = "";
  resultMsg.className = "result-msg";

  if (alreadyPaid) {
    payBtn.disabled = true;
    payBtn.textContent = "Já pago";
    resultMsg.textContent = "Esse pedido já foi confirmado nesta sessão.";
    resultMsg.classList.add("success");
  } else {
    payBtn.disabled = false;
    payBtn.textContent = "Pagar";
  }
}

function showLoading() {
  emptyState.textContent = "Lendo QR da aba...";
  emptyState.style.display = "block";
  capturedState.style.display = "none";
}

//funções injetadas na aba ativa

function readQrFromPage() {
  const img =
    document.querySelector(".qrcode-container img") ||
    document.querySelector('img[src^="data:image"]');

  if (!img) return { error: "Nenhuma imagem de QR encontrada nesta página." };

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const result = window.jsQR(imageData.data, canvas.width, canvas.height);
  if (!result) return { error: "Não consegui decodificar o QR (imagem ilegível)." };

  try {
    const jsonStr = atob(result.data);
    const parsed = JSON.parse(jsonStr);
    if (!parsed.id) return { error: "QR decodificado, mas sem campo 'id'.", raw: result.data };
    return { id: parsed.id };
  } catch (err) {
    return { error: "QR não é o formato esperado (base64 JSON).", raw: result.data };
  }
}

async function isTxidPaid(txid) {
  const { paidTxids } = await chrome.storage.session.get(["paidTxids"]);
  return Array.isArray(paidTxids) && paidTxids.includes(txid);
}

async function markTxidAsPaid(txid) {
  const { paidTxids } = await chrome.storage.session.get(["paidTxids"]);
  const list = Array.isArray(paidTxids) ? paidTxids : [];
  if (!list.includes(txid)) list.push(txid);
  await chrome.storage.session.set({ paidTxids: list });
}

async function readCurrentTab() {
  showLoading();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["libs/jsQR.js"]
    });

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readQrFromPage
    });

    if (result.error) {
      showEmpty(result.error);
      return;
    }

    const alreadyPaid = await isTxidPaid(result.id);
    showCaptured(result.id, alreadyPaid);
  } catch (err) {
    showEmpty(`Erro ao ler a aba: ${err.message}`);
  }
}

async function confirmPagamento(txid) {
  const url = `${API_BASE}/notification/shipay-pagador/${txid}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  return { status: response.status, data: await response.json() };
}

payBtn.addEventListener("click", async () => {
  if (!currentTxid) return;

  payBtn.disabled = true;
  payBtn.textContent = "Pagando...";
  resultMsg.textContent = "";
  resultMsg.className = "result-msg";

  try {
    const { status, data } = await confirmPagamento(currentTxid);
    resultMsg.textContent = `[${status}] ${data.message || JSON.stringify(data)}`;

    if (status === 200) {
      resultMsg.classList.add("success");
      await markTxidAsPaid(currentTxid);
      payBtn.textContent = "Já pago";
      // fica desabilitado de propósito, não volta a "Pagar" pro mesmo txid
    } else {
      resultMsg.classList.add("error");
      payBtn.disabled = false;
      payBtn.textContent = "Pagar";
    }
  } catch (err) {
    resultMsg.textContent = `Erro: ${err.message}`;
    resultMsg.classList.add("error");
    payBtn.disabled = false;
    payBtn.textContent = "Pagar";
  }
});

refreshBtn.addEventListener("click", readCurrentTab);

// lê automaticamente assim que o popup abre
readCurrentTab();