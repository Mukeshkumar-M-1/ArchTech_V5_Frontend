import { useEffect, useRef, useCallback } from 'react';
import { Viewer, Worker, ScrollMode, ViewMode } from '@react-pdf-viewer/core';
import { pageNavigationPlugin } from '@react-pdf-viewer/page-navigation';
import { zoomPlugin } from '@react-pdf-viewer/zoom';
import '@react-pdf-viewer/core/lib/styles/index.css';

const PdfViewer = ({
  src,
  page = 1,
  className = '',
  layoutMode = 'scroll',
  zoom = 100,
  highlightTexts = [],
  onPdfPageChange,
  onTextSelection,
  onDocumentLoad,
  onPluginReady,
}) => {
  const containerRef = useRef(null);

  const onDocumentLoadRef = useRef(onDocumentLoad);
  useEffect(() => { onDocumentLoadRef.current = onDocumentLoad; }, [onDocumentLoad]);

  const onPluginReadyRef = useRef(onPluginReady);
  useEffect(() => { onPluginReadyRef.current = onPluginReady; }, [onPluginReady]);

  const navPlugin = pageNavigationPlugin();
  const { jumpToPage } = navPlugin;

  const zoomPlgn = zoomPlugin();
  const { zoomTo } = zoomPlgn;

  const allPlugins = [navPlugin, zoomPlgn];

  useEffect(() => {
    if (onPluginReadyRef.current) {
      onPluginReadyRef.current(navPlugin);
    }
  }, []);

  useEffect(() => {
    if (page > 0) {
      jumpToPage(page - 1);
    }
  }, [page, jumpToPage]);

  // Sync zoom prop with viewer
  useEffect(() => {
    zoomTo(zoom / 100);
  }, [zoom, zoomTo]);



  // Highlight requirement text on the PDF page
  useEffect(() => {
    // Step 1: Guard checks
    if (!highlightTexts || !highlightTexts.length) {
      return;
    }
    if (!containerRef.current) {
      return;
    }

    const applyHighlights = () => {
      // Step 2: Find the text layer for this page
      const textLayer = containerRef.current.querySelector(
        `[data-testid="core__text-layer-${page - 1}"]`
      );
      if (!textLayer) {
        return false;
      }

      // Step 3: Clear previous overlays from this text layer's sibling container
      const layersParent = textLayer.parentElement;
      if (!layersParent) return true;
      const oldOverlay = layersParent.querySelector('.pdf-highlight-overlay');
      if (oldOverlay) oldOverlay.remove();

      // Step 4: Normalize helper
      const cleanWord = (word) => {
        if (typeof word === 'object') word = word.text || '';
        return String(word).toLowerCase().replace(/[^a-z0-9+/]/g, '').trim();
      };

      // Step 5: Build word list from spans
      const spans = textLayer.querySelectorAll('span');
      if (!spans.length) {
        return true;
      }

      const wordEntries = [];
      let originalWordIndex = 0;

      spans.forEach((span, spanIdx) => {
        const text = span.textContent || '';
        const spanWords = text.split(/\s+/);
        spanWords.forEach((word) => {
          if (!word) return;
          const normalized = cleanWord(word);
          if (!normalized) return;
          wordEntries.push({
            normalized,
            spanIndex: spanIdx,
            originalIndex: originalWordIndex,
          });
          originalWordIndex++;
        });
      });

      if (wordEntries.length === 0) return true;

      // --- Longest continuous match using word-level binary search ---

      // Find the longest contiguous sequence of reqWords that appears
      // in wordEntries, using a sliding window approach.
      // Returns { start, end } indices into wordEntries, or null if no good match.
      function findBestSubstringMatch(reqWords, wordList) {
        if (reqWords.length < 2) return null;

        // Binary search: try window sizes from largest down to threshold
        const maxWindow = Math.min(reqWords.length, wordList.length);
        let bestResult = null;
        let bestCount = 0;

        // Try each window size from largest to smallest
        for (let windowLen = maxWindow; windowLen >= 3; windowLen--) {
          for (let i = 0; i <= wordList.length - windowLen; i++) {
            const windowWords = wordList.slice(i, i + windowLen).map(e => e.normalized);

            // Count how many req words are in this window (at least 70% threshold)
            const matchCount = windowWords.filter(w => reqWords.includes(w)).length;
            const ratio = matchCount / windowLen;

            if (ratio >= 0.7 && matchCount > bestCount) {
              bestResult = { start: i, end: i + windowLen - 1 };
              bestCount = matchCount;
            }
          }
          // Once we found a match at this size, no need to try smaller windows
          if (bestResult) break;
        }

        return bestResult;
      }

      // Step 6: Find best continuous match for each requirement text
      // Each requirement gets its own bounding box
      const reqMatches = []; // [{ reqId, matchedIndices: [int] }]

      highlightTexts.forEach((req) => {
        const reqText = typeof req === 'object' ? (req.text || '') : req;
        const reqWords = String(reqText).split(/\s+/).map(cleanWord).filter(Boolean);
        if (reqWords.length === 0) return;

        const bestMatch = findBestSubstringMatch(reqWords, wordEntries);
        if (bestMatch) {
          const matchedIndices = [];
          for (let i = bestMatch.start; i <= bestMatch.end; i++) {
            matchedIndices.push(i);
          }
          reqMatches.push({ reqId: req.id, matchedIndices });
        }
      });

      if (reqMatches.length === 0) return true;

      // Step 7: Create a bounding box per requirement
      const overlay = document.createElement('div');
      overlay.className = 'pdf-highlight-overlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '999';
      overlay.style.overflow = 'visible';

      const textRect = textLayer.getBoundingClientRect();

      const borderColors = ['#3b82f6', '#10b981', '#a855f7', '#f97316', '#ec4899', '#14b8a6', '#f59e0b', '#6366f1'];

      reqMatches.forEach((match, idx) => {
        const color = borderColors[idx % borderColors.length];
        // Full hex color with 15% opacity for background
        const bgHex = color + '26';

        // Compute bounding rect from matched word indices
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const reqSpanIndices = new Set();
        match.matchedIndices.forEach((wordIdx) => {
          const entry = wordEntries[wordIdx];
          reqSpanIndices.add(entry.spanIndex);
          const span = spans[entry.spanIndex];
          const spanRect = span.getBoundingClientRect();
          if (spanRect.left < minX) minX = spanRect.left;
          if (spanRect.top < minY) minY = spanRect.top;
          if (spanRect.right > maxX) maxX = spanRect.right;
          if (spanRect.bottom > maxY) maxY = spanRect.bottom;
        });

        // Draw colored bounding box with padding
        const padding = 3;
        const box = document.createElement('div');
        box.className = 'pdf-highlight-rect';
        box.style.position = 'absolute';
        box.style.left = `${minX - textRect.left - padding}px`;
        box.style.top = `${minY - textRect.top - padding}px`;
        box.style.width = `${maxX - minX + padding * 2}px`;
        box.style.height = `${maxY - minY + padding * 2}px`;
        box.style.border = `2px solid ${color}80`;
        box.style.borderRadius = '4px';
        box.style.background = bgHex;
        box.style.pointerEvents = 'auto';
        box.style.cursor = 'default';
        box.style.transition = 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, z-index 0s';
        box.style.boxShadow = '0 0 0 0 transparent';
        // Base z-index so boxes stack in order — hovered box rises above all
        box.style.zIndex = String(1000 + idx);

        // Hover effect — bright border + lift above other boxes, dim all others
        box.addEventListener('mouseenter', () => {
          box.style.borderColor = color;
          box.style.background = color + '40';
          box.style.boxShadow = `0 0 0 2px ${color}30`;
          box.style.zIndex = '9999';
          // Dim all sibling boxes
          const allBoxes = overlay.querySelectorAll('.pdf-highlight-rect');
          allBoxes.forEach((other) => {
            if (other !== box) {
              other.style.opacity = '0.2';
            }
          });
        });
        box.addEventListener('mouseleave', () => {
          box.style.borderColor = color + '80';
          box.style.background = bgHex;
          box.style.boxShadow = '0 0 0 0 transparent';
          box.style.zIndex = String(1000 + idx);
          // Restore all sibling boxes
          const allBoxes = overlay.querySelectorAll('.pdf-highlight-rect');
          allBoxes.forEach((other) => {
            other.style.opacity = '1';
          });
        });

        // Requirement ID label in top-left corner
        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.top = '-1px';
        label.style.left = '-100px';
        label.style.padding = '1px 5px';
        label.style.fontSize = '16px';
        label.style.fontWeight = '700';
        label.style.fontFamily = 'monospace';
        label.style.lineHeight = '14px';
        label.style.borderRadius = '3px';
        label.style.color = '#fff';
        label.style.background = color;
        label.style.letterSpacing = '0.03em';
        label.style.whiteSpace = 'nowrap';
        label.style.userSelect = 'none';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.pointerEvents = 'none';
        label.textContent = match.reqId;
        box.appendChild(label);

        overlay.appendChild(box);
      });

      layersParent.appendChild(overlay);
      return true;
    };

    // Try immediately; if text layer not ready, observe DOM changes
    const isRendered = applyHighlights();
    if (!isRendered) {
      const observer = new MutationObserver(() => {
        const success = applyHighlights();
        if (success) observer.disconnect();
      });
      observer.observe(containerRef.current, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, [highlightTexts, page]);

  const handleTextSelection = useCallback(() => {
    if (!onTextSelection) return;
    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (!text) return;

    const target = selection.anchorNode?.parentElement;
    // Text layers are flat siblings: core__text-layer-N — no page container wrapper
    const layerDiv = target?.closest('[data-testid*="-layer-"]');
    const pageIndex = layerDiv
      ? parseInt(layerDiv.getAttribute('data-testid').split('-').pop(), 10)
      : 0;

    const rect = target?.getBoundingClientRect();
    onTextSelection({ text, pageIndex, rect });
  }, [onTextSelection]);

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener('mouseup', handleTextSelection);
    }
    return () => {
      if (el) el.removeEventListener('mouseup', handleTextSelection);
    };
  }, [handleTextSelection]);

  const handlePageChange = useCallback(
    (e) => {
      if (onPdfPageChange) {
        onPdfPageChange(e.currentPage + 1);
      }
    },
    [onPdfPageChange],
  );

  const isScroll = layoutMode === 'scroll';

  return (
    <div
      ref={containerRef}
      className={`flex flex-col items-center h-full w-full ${isScroll ? 'overflow-hidden' : ''} ${className}`}
    >
      <Worker workerUrl="/pdfjs/pdf.worker.js">
        <Viewer
          key={layoutMode}
          fileUrl={src}
          plugins={allPlugins}
          initialPage={page - 1}
          onPageChange={handlePageChange}
          defaultScale={zoom}
          scrollMode={isScroll ? ScrollMode.Vertical : ScrollMode.Page}
          viewMode={ViewMode.SinglePage}
          withCredentials={true}
          onDocumentLoad={(props) => {
            if (onDocumentLoadRef.current) {
              onDocumentLoadRef.current({ numPages: props.doc.numPages, doc: props.doc });
            }
          }}
        />
      </Worker>
    </div>
  );
};

export default PdfViewer;
