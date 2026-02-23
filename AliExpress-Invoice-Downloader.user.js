// ==UserScript==
// @name         AliExpress Invoice Downloader
// @namespace    https://www.aliexpress.com
// @version      1.4
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

  const dl_invoice = (date, order_id, name) => {
    var sanitized_name = name
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[/\\?%*:|"<>]/g, "_")
      .substring(0, 16);
    sanitized_name = date === null
      ? `invoice_${order_id}_${sanitized_name}.pdf`
      : `invoice_${date}_${order_id}_${sanitized_name}.pdf`

    const url = `https://trade.aliexpress.com/ajax/invoice/invoiceExportAjax.htm?orderId=${order_id}`;
    GM_download({
      url: url,
      name: sanitized_name,
      onerror: function (error) {
        console.error("Aliexpress invoice downloader: Error downloading:", error);
      },
    });
  }

  // annoyingly they do not provide the date as an iso string or unix timestamp, but as a localized string
  // only consider english strings.
  const convert_date_str = (date_str) => {
    const date_str_conv = date_str.replace("Order date: ", "")
      .replace(",", "")
      .replace("Jan", "01")
      .replace("Feb", "02")
      .replace("Mar", "03")
      .replace("Apr", "04")
      .replace("May", "05")
      .replace("Jun", "06")
      .replace("Jul", "07")
      .replace("Aug", "08")
      .replace("Sep", "09")
      .replace("Oct", "10")
      .replace("Nov", "11")
      .replace("Dec", "12")

    const date_split = date_str_conv.split(' ')

    if (/[^0-9\s]/.test(date_str_conv)) {
      console.error("Aliexpress invoice downloader: date only interpreted in english.")
      return null
    } else {
      return `${date_split[2]}-${date_split[0]}-${date_split[1]}`
    }
  }

  const create_dl_button = (order_elem) => {
    const order_name_elem = order_elem.querySelector(
      "div.order-item-content-info-name"
    );
    const order_name = order_name_elem
      ? order_name_elem.textContent.trim()
      : `MULTIPLE_${order_elem.querySelector("div.order-item-store").textContent}`;
    const order_link = order_elem.querySelector(
      "div.order-item-header > div.order-item-header-right > a"
    ) || order_elem;
    if (order_link) {
      const href = order_link.getAttribute("href");
      const order_header_elem = order_elem.querySelector("div.order-item-header");
      if (href) {
        const date_elem = order_header_elem.querySelector("div.order-item-header-right-info > div") || order_header_elem.querySelector("div.order-item-header-right")
        const date = convert_date_str(date_elem.textContent);
        const url = new URL(href, window.location.href);
        const order_id = url.searchParams.get("orderId");
        if (order_id) {
          order_ids.push({ id: order_id, name: order_name, date: date });

          const dl_button = document.createElement("button");
          dl_button.textContent = "Download Invoice";
          dl_button.className = "aliexpress-invoice-download-button";
          dl_button.style.marginLeft = "10px";
          dl_button.addEventListener("click", (e) => {
            e.preventDefault(); // mobile interface where <a> covers whole item
            dl_invoice(date, order_id, order_name);
          });
          order_header_elem.appendChild(dl_button);
        }
      }
    }
  }

  const invoice_mut_cb = (mutations) => {
    for (let mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((order_elem) => {
          if (order_elem.matches && order_elem.matches("div.order-item,a.order-item.order-item-mobile")) {
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
      const order_elems = document.querySelectorAll("div.order-item,a.order-item.order-item-mobile");
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
      dl_invoice(order.date, order.id, order.name);
    });
  });
  document.body.appendChild(bulk_dl_button);

})();
