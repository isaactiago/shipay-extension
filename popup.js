// popup.js

const API_BASE = "https://api-staging.shipay.com.br";

const emptyState = document.getElementById("empty-state");
const capturedState = document.getElementById("captured-state");
const txidValueEl = document.getElementById("txid-value");
const payBtn = document.getElementById("pay-btn");
const resultMsg = document.getElementById("result-msg");
const readBtn = document.getElementById("read-qr-btn");

let currentTxid = null;

function showEmpty(message) {
  emptyState.textContent = message || "Abra a aba com o QR do PDV e clique abaixo.";
  emptyState.style.display = "block";
  capturedState.style.display = "none";
}

function showCaptured(txid) {
  currentTxid = txid;
  emptyState.style.display = "none";
  capturedState.style.display = "block";
  txidValueEl.textContent = txid;
  resultMsg.textContent = "";
  resultMsg.className = "result-msg";
}

// Função injetada DENTRO da aba ativa. Não tem acesso a variáveis do popup,
// só pode retornar dados simples (string/objeto serializável).
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

  // window.jsQR precisa já ter sido injetado antes desta função rodar
  const result = window.jsQR(imageData.data, canvas.width, canvas.height);
  if (!result) return { error: "Não consegui decodificar o QR (imagem ilegível)." };

  try {
    const jsonStr = atob(result.data);
    const parsed = JSON.parse(jsonStr);
    if (!parsed.id) return { error: "QR decodificado, mas sem campo 'id'.", raw: result.data };
    return { id: parsed.id, raw: result.data };
  } catch (err) {
    return { error: "QR não é o formato esperado (base64 JSON).", raw: result.data };
  }
}

readBtn.addEventListener("click", async () => {
  readBtn.disabled = true;
  readBtn.textContent = "Lendo...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // 1) injeta a lib jsQR na aba
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["libs/jsQR.js"]
    });

    // 2) injeta e executa a função de leitura, pegando o retorno
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readQrFromPage
    });

    if (result.error) {
      showEmpty(result.error);
    } else {
      chrome.storage.local.set({ lastTxid: result.id });
      showCaptured(result.id);
    }
  } catch (err) {
    showEmpty(`Erro ao ler a aba: ${err.message}`);
  } finally {
    readBtn.disabled = false;
    readBtn.textContent = "Ler QR desta aba";
  }
});

async function confirmPagamento(txid) {
  const url = `${API_BASE}/notification/shipay-pagador/${txid}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  return { status: resp.status, data: await resp.json() };
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
    resultMsg.classList.add(status === 200 ? "success" : "error");
  } catch (err) {
    resultMsg.textContent = `Erro: ${err.message}`;
    resultMsg.classList.add("error");
  } finally {
    payBtn.disabled = false;
    payBtn.textContent = "Pagar";
  }
});

// estado inicial: recupera o último txid salvo, se houver
chrome.storage.local.get(["lastTxid"], (data) => {
  if (data.lastTxid) showCaptured(data.lastTxid);
});