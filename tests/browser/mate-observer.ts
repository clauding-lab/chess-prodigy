// Passed to page.evaluate: keep this function self-contained.
export function observeInjectedMate() {
  Reflect.set(window, "__acceptedInjectedMate", false);
  const inspect = (node: Node) => {
    if (!(node instanceof Element)) return;
    const bars = node.matches(".evalbar") ? [node] : [...node.querySelectorAll(".evalbar")];
    if (bars.some((bar) => /mates/.test(bar.getAttribute("aria-label") ?? "")))
      Reflect.set(window, "__acceptedInjectedMate", true);
  };
  new MutationObserver((records) => {
    inspect(document.body);
    for (const record of records) {
      inspect(record.target);
      if (
        record.type === "attributes" &&
        record.target instanceof Element &&
        record.target.matches(".evalbar") &&
        /mates/.test(record.oldValue ?? "")
      )
        Reflect.set(window, "__acceptedInjectedMate", true);
      record.addedNodes.forEach(inspect);
      record.removedNodes.forEach(inspect);
    }
  }).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["aria-label"],
  });
}
