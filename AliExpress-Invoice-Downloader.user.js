// ==UserScript==
// @name         AliExpress Invoice Downloader
// @namespace    https://www.aliexpress.com
// @version      1.3
// @description  Adds download buttons to the Aliexpress order page (https://www.aliexpress.com/p/order/index.html) and a bulk download button to download all invoices on the order page to save time.
// @match        https://www.aliexpress.com/p/order/index.html*
// @grant        GM_download
// @author       Peter Tanner
// @namespace    https://github.com/peter-tanner/AliExpress-Invoice-Downloader/
// @supportURL   https://github.com/peter-tanner/AliExpress-Invoice-Downloader/issues
// @updateURL    https://github.com/peter-tanner/AliExpress-Invoice-Downloader/AliExpress-Invoice-Downloader.user.js
// @license      GPL-3.0
// @website      https://www.petertanner.dev/
// ==/UserScript==

(function () {
  "use strict";

  let order_ids = [];

  function dl_invoice(order_id, name) {
    const sanitized_name = name
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[/\\?%*:|"<>]/g, "_")
      .substring(0, 16);

    const url = `https://trade.aliexpress.com/ajax/invoice/invoiceExportAjax.htm?orderId=${order_id}`;
    GM_download({
      url: url,
      name: `invoice_${order_id}_${sanitized_name}.pdf`,
      onerror: function (error) {
        console.error("Error downloading:", error);
      },
    });
  }

  function create_dl_button(order_elem) {
    const order_name_elem = order_elem.querySelector(
      "div.order-item-content-info-name"
    );
    const order_name = order_name_elem
      ? order_name_elem.textContent.trim()
      : `MULTIPLE_${order_elem.querySelector("div.order-item-store").textContent}`;
    const order_link = order_elem.querySelector(
      "div.order-item-header > div.order-item-header-right > a"
    );
    if (order_link) {
      const href = order_link.getAttribute("href");
      if (href) {
        const url = new URL(href, window.location.href);
        const order_id = url.searchParams.get("orderId");
        if (order_id) {
          order_ids.push({ id: order_id, name: order_name });

          const dl_button = document.createElement("button");
          dl_button.textContent = "Download Invoice";
          dl_button.className = "aliexpress-invoice-download-button";
          dl_button.style.marginLeft = "10px";
          dl_button.addEventListener("click", () => {
            dl_invoice(order_id, order_name);
          });
          order_link.parentNode.appendChild(dl_button);
        }
      }
    }
  }

  const invoice_mut_cb = (mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((order_elem) => {
          if (order_elem.matches && order_elem.matches("div.order-item")) {
            create_dl_button(order_elem)
          }
        });
      }
    }
  };

  const add_invoice_mut_observer = () => {
    const targetNode = document.querySelector("div.order-content");
    if (targetNode) {
      const observer = new MutationObserver(invoice_mut_cb);
      const config = { childList: true, subtree: true };
      observer.observe(targetNode, config);

      // force create for initially rendered orders 
      const order_elems = document.querySelectorAll("div.order-item");
      order_elems.forEach((order_elem) => {
        create_dl_button(order_elem)
      });
    } else {
      setTimeout(add_invoice_mut_observer, 100);
    }
  };

  add_invoice_mut_observer();

  const bulk_dl_button = document.createElement("button");
  bulk_dl_button.textContent = "Download All Invoices";
  bulk_dl_button.style.position = "fixed";
  bulk_dl_button.style.bottom = "10px";
  bulk_dl_button.style.left = "10px";
  bulk_dl_button.style.zIndex = "1000";
  bulk_dl_button.style.backgroundColor = "red";
  bulk_dl_button.style.color = "white";
  bulk_dl_button.style.padding = "10px";
  bulk_dl_button.addEventListener("click", () => {
    order_ids.forEach((order) => {
      dl_invoice(order.id, order.name);
    });
  });
  document.body.appendChild(bulk_dl_button);

})();
