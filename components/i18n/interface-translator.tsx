"use client";

import { useEffect } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { translateInterfaceText } from "@/lib/i18n/interface-phrases";

const translatedAttributes = ["aria-label", "aria-description", "placeholder", "title"] as const;
const originalText = new WeakMap<Node, string>();
const lastAppliedText = new WeakMap<Node, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const lastAppliedAttributes = new WeakMap<Element, Map<string, string>>();
const internallyChangedText = new WeakSet<Node>();
const internallyChangedAttributes = new WeakMap<Element, Set<string>>();

function shouldSkip(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
  return Boolean(element?.closest(
    "[data-no-translate], [translate='no'], script, style, code, pre, textarea",
  ));
}

function translateTextNode(node: Node, locale: ReturnType<typeof useLanguage>["locale"]) {
  if (node.nodeType !== Node.TEXT_NODE || shouldSkip(node)) return;
  const current = node.nodeValue ?? "";
  const previousApplied = lastAppliedText.get(node);
  if (!originalText.has(node) || (previousApplied !== undefined && current !== previousApplied)) {
    originalText.set(node, current);
  }
  const source = originalText.get(node) ?? current;
  const translated = translateInterfaceText(source, locale);
  lastAppliedText.set(node, translated);
  if (current !== translated) {
    internallyChangedText.add(node);
    node.nodeValue = translated;
  }
}

function translateElementAttributes(
  element: Element,
  locale: ReturnType<typeof useLanguage>["locale"],
) {
  if (shouldSkip(element)) return;
  let originals = originalAttributes.get(element);
  let applied = lastAppliedAttributes.get(element);
  if (!originals) {
    originals = new Map();
    originalAttributes.set(element, originals);
  }
  if (!applied) {
    applied = new Map();
    lastAppliedAttributes.set(element, applied);
  }

  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    const previousApplied = applied.get(attribute);
    if (!originals.has(attribute) || (previousApplied !== undefined && current !== previousApplied)) {
      originals.set(attribute, current);
    }
    const translated = translateInterfaceText(originals.get(attribute) ?? current, locale);
    applied.set(attribute, translated);
    if (translated !== current) {
      let changed = internallyChangedAttributes.get(element);
      if (!changed) {
        changed = new Set();
        internallyChangedAttributes.set(element, changed);
      }
      changed.add(attribute);
      element.setAttribute(attribute, translated);
    }
  }
}

function translateTree(root: Node, locale: ReturnType<typeof useLanguage>["locale"]) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, locale);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE || shouldSkip(root)) return;

  const element = root as Element;
  translateElementAttributes(element, locale);
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, locale);
    else translateElementAttributes(node as Element, locale);
    node = walker.nextNode();
  }
}

export function InterfaceTranslator() {
  const { locale } = useLanguage();

  useEffect(() => {
    translateTree(document.body, locale);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          if (internallyChangedText.has(mutation.target)) {
            internallyChangedText.delete(mutation.target);
            continue;
          }
          originalText.set(mutation.target, mutation.target.nodeValue ?? "");
          lastAppliedText.delete(mutation.target);
          translateTextNode(mutation.target, locale);
          continue;
        }

        if (mutation.type === "attributes" && mutation.attributeName) {
          const changed = internallyChangedAttributes.get(mutation.target as Element);
          if (changed?.has(mutation.attributeName)) {
            changed.delete(mutation.attributeName);
            continue;
          }
          originalAttributes.get(mutation.target as Element)?.delete(mutation.attributeName);
          lastAppliedAttributes.get(mutation.target as Element)?.delete(mutation.attributeName);
          translateElementAttributes(mutation.target as Element, locale);
          continue;
        }

        mutation.addedNodes.forEach((node) => translateTree(node, locale));
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...translatedAttributes],
    });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
