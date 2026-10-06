'use client';

import {useEffect} from 'react';

/**
 * Phones show each Admin table row as a card (see globals.css). This copies every column title onto its cells as
 * `data-label`, so each value keeps its label, for every table on every Admin page, including rows loaded later.
 */
export default function AdminTableLabels() {
  useEffect(() => {
    let frame = 0;
    const label = () => {
      frame = 0;
      for (const table of document.querySelectorAll<HTMLTableElement>('.admin-surface table.admin-table')) {
        const titles = [...table.querySelectorAll('thead th')].map(cell => cell.textContent?.trim() ?? '');
        for (const body of table.tBodies) for (const row of body.rows) [...row.cells].forEach((cell, index) => {
          if (cell.colSpan === 1 && titles[index] && cell.dataset.label !== titles[index]) cell.dataset.label = titles[index];
        });
      }
    };
    label();
    const observer = new MutationObserver(() => {if (!frame) frame = requestAnimationFrame(label);});
    observer.observe(document.body, {childList: true, subtree: true});
    return () => {observer.disconnect(); cancelAnimationFrame(frame);};
  }, []);
  return null;
}
