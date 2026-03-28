export function printHtmlDocument({ title, html }) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove();
    }, 200);
  };

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      cleanup();
      throw new Error("Unable to access print frame.");
    }

    frameWindow.focus();

    if ("onafterprint" in frameWindow) {
      frameWindow.onafterprint = cleanup;
    } else {
      window.setTimeout(cleanup, 1000);
    }

    window.setTimeout(() => {
      frameWindow.print();
    }, 150);
  };

  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  if (!frameDocument) {
    cleanup();
    throw new Error("Unable to create print document.");
  }

  frameDocument.open();
  frameDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`);
  frameDocument.close();
}
