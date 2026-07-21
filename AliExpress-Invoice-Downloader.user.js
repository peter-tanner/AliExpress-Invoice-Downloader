// ==UserScript==
// @name         AliExpress Invoice Downloader
// @namespace    https://www.aliexpress.com
// @version      2.0
// @description  Downloads order receipts from AliExpress. The old invoiceExportAjax.htm endpoint was shut down ("page under maintenance"); this version automates the current flow: order detail page -> "Receipt" button -> tax-ui modal -> Download (PNG). Adds per-order buttons and a bulk downloader to the order list.
// @match        https://www.aliexpress.com/p/order/index.html*
// @match        https://www.aliexpress.com/p/order/detail.html*
// @grant        none
// @author       Peter Tanner
// @namespace    https://github.com/peter-tanner/AliExpress-Invoice-Downloader/
// @supportURL   https://github.com/peter-tanner/AliExpress-Invoice-Downloader/issues
// @updateURL    https://github.com/peter-tanner/AliExpress-Invoice-Downloader/AliExpress-Invoice-Downloader.user.js
// @license      GPL-3.0
// @website      https://www.petertanner.dev/
// ==/UserScript==

// Rewritten 2026: trade.aliexpress.com/ajax/invoice/invoiceExportAjax.htm is dead
// (redirects to error.htm / "page under maintenance", see issues #1-#3).
// Current working flow (verified on de-DE and en-US):
//   detail page -> button [data-pl="order_block_btn"] with text "Receipt"
//   -> same-origin iframe /p/tax-ui/index.html -> click #download-receipt
//   -> browser downloads "OrderSummary<date><orderId>.png"
// Orders that were refunded/cancelled have no Receipt button.

(function () {
  "use strict";

  const AUTO_FLAG = "ali-inv-dl";
  const RECEIPT_TEXTS = /^(receipt|beleg|rechnung|recibo|reçu|fatura)$/i;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ------------------- detail page: perform the download -------------------
  async function autoDownloadOnDetail() {
    let btn = null;
    for (let i = 0; i < 30 && !btn; i++) {
      btn = [...document.querySelectorAll("button, a")].find((b) =>
        RECEIPT_TEXTS.test((b.textContent || "").trim())
      );
      if (!btn) await sleep(1000);
    }
    if (!btn) {
      console.error("[ali-inv-dl] no Receipt button (order refunded/cancelled?)");
      return false;
    }
    btn.click();

    // wait for the same-origin tax-ui iframe and its download button
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      for (const frame of document.querySelectorAll("iframe")) {
        try {
          const doc = frame.contentDocument;
          if (!doc) continue;
          const dl =
            doc.querySelector("#download-receipt") ||
            [...doc.querySelectorAll("a, button, div")].find((e) =>
              /^(download|herunterladen)$/i.test((e.textContent || "").trim())
            );
          if (dl) {
            dl.click();
            console.info("[ali-inv-dl] receipt download triggered");
            return true;
          }
        } catch (e) {
          /* cross-origin frame -> ignore */
        }
      }
    }
    console.error("[ali-inv-dl] download button not found in tax-ui frame");
    return false;
  }

  // ------------------- order list: add buttons -------------------
  function orderIdOf(orderElem) {
    for (const a of orderElem.querySelectorAll("a")) {
      const m = (a.getAttribute("href") || "").match(/orderId=(\d{10,})/);
      if (m) return m[1];
    }
    return null;
  }

  const detailUrl = (orderId) =>
    "https://www.aliexpress.com/p/order/detail.html?orderId=" + orderId + "#" + AUTO_FLAG;

  function addButtons() {
    document.querySelectorAll(".order-item").forEach((order) => {
      if (order.dataset.aliInvDl) return;
      const oid = orderIdOf(order);
      if (!oid) return;
      order.dataset.aliInvDl = "1";
      const btn = document.createElement("button");
      btn.textContent = "⭳ Receipt";
      btn.style.cssText =
        "margin:4px;padding:2px 10px;cursor:pointer;border:1px solid #d3d3d3;border-radius:12px;background:#fff;";
      btn.onclick = () => window.open(detailUrl(oid), "_blank");
      (order.querySelector(".order-item-btns") || order).appendChild(btn);
    });

    if (!document.getElementById("ali-inv-dl-all")) {
      const all = document.createElement("button");
      all.id = "ali-inv-dl-all";
      all.textContent = "⭳ DOWNLOAD ALL RECEIPTS";
      all.style.cssText =
        "position:fixed;bottom:16px;left:16px;z-index:99999;padding:10px 16px;background:#c00;color:#fff;border:none;border-radius:8px;cursor:pointer;";
      all.onclick = async () => {
        const ids = [...document.querySelectorAll(".order-item")]
          .map(orderIdOf)
          .filter(Boolean);
        all.disabled = true;
        for (let i = 0; i < ids.length; i++) {
          all.textContent = `⭳ ${i + 1}/${ids.length} ...`;
          const w = window.open(detailUrl(ids[i]), "_blank");
          await sleep(15000); // load + click-through + download time
          try { if (w) w.close(); } catch (e) {}
        }
        all.textContent = "⭳ DONE";
        all.disabled = false;
      };
      document.body.appendChild(all);
    }
  }

  // ------------------- entry -------------------
  if (location.pathname.includes("/p/order/detail.html")) {
    if (location.hash.includes(AUTO_FLAG)) autoDownloadOnDetail();
  } else {
    setInterval(addButtons, 2000);
  }
})();
