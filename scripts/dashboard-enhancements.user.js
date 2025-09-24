// ==UserScript==
// @name         OpenSearch Dashboard Enhancements
// @namespace    http://tampermonkey.net/
// @version      1.0.01
// @description  Enhance OpenSearch Dashboard functionality
// @match        *://*.aws.dev/_dashboards*
// @downloadURL  https://raw.githubusercontent.com/phengsamazon/opensearch-dashboard-enhancements/main/scripts/dashboard-enhancements.user.js
// @updateURL    https://raw.githubusercontent.com/phengsamazon/opensearch-dashboard-enhancements/main/scripts/dashboard-enhancements.user.js
// @grant        unsafeWindow
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function() {
    'use strict';

    // Check if we're actually in OpenSearch Dashboards
    //if (!window.location.pathname.includes('/_dashboards')) {
    //    return;
    //}

    // Utility functions
    const utils = {
        injectStyle(css) {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
            return style;
        },

        createObserver(callback, config = { childList: true, subtree: true }) {
            const observer = new MutationObserver(callback);
            return observer;
        }
    };

    // DOM Watchers
    const domWatchers = {
        waitForElement(selector, timeout = 10000) {
            return new Promise((resolve, reject) => {
                const element = document.querySelector(selector);
                if (element) {
                    return resolve(element);
                }

                const observer = utils.createObserver((mutations, obs) => {
                    const element = document.querySelector(selector);
                    if (element) {
                        obs.disconnect();
                        resolve(element);
                    }
                });

                observer.observe(document.body, { childList: true, subtree: true });

                setTimeout(() => {
                    observer.disconnect();
                    reject(new Error(`Timeout waiting for ${selector}`));
                }, timeout);
            });
        },

        waitForMultipleElements(selectors, timeout = 10000) {
            return Promise.all(selectors.map(selector =>
                                             this.waitForElement(selector, timeout)
                                            ));
        },

        waitForStableElements(selector, stabilityCount = 3, checkInterval = 500, timeout = 10000) {
            return new Promise((resolve, reject) => {
                let lastCount = 0;
                let stableCount = 0;
                const startTime = Date.now();

                const check = () => {
                    const elements = document.querySelectorAll(selector);

                    if (elements.length === lastCount) {
                        stableCount++;
                    } else {
                        stableCount = 0;
                        lastCount = elements.length;
                    }

                    if (stableCount >= stabilityCount) {
                        return resolve(elements);
                    }

                    if (Date.now() - startTime > timeout) {
                        return reject(new Error(`Timeout waiting for stable ${selector}`));
                    }

                    setTimeout(check, checkInterval);
                };

                check();
            });
        },

        waitForMarkdown(timeout = 10000) {
            return new Promise((resolve) => {
                let lastCount = 0;
                let stableCount = 0;

                const observer = utils.createObserver(() => {
                    const markdownElements = document.querySelectorAll('.markdown-widget, [data-test-subj*="markdown"]');

                    if (markdownElements.length > 0) {
                        console.log(`Found ${markdownElements.length} markdown elements`);

                        if (markdownElements.length === lastCount) {
                            stableCount++;
                        } else {
                            stableCount = 0;
                            lastCount = markdownElements.length;
                        }

                        if (stableCount >= 3) {
                            console.log('Markdown elements have stabilized');
                            observer.disconnect();
                            resolve(markdownElements);
                        }
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });

                setTimeout(() => {
                    observer.disconnect();
                    const markdownElements = document.querySelectorAll('.markdown-widget, [data-test-subj*="markdown"]');
                    console.log('Markdown timeout reached, found:', markdownElements.length);
                    resolve(markdownElements);
                }, timeout);
            });
        }
    };

    // Feature modules
    const features = {
        async hideVegaWarnings() {
            const css = `
                .vgaVis__messages,
                .vega-messages,
                [class*="vega"][class*="message"],
                [class*="vega"][class*="warning"] {
                    display: none !important;
                    visibility: hidden !important;
                }
            `;
            utils.injectStyle(css);

            return Promise.resolve('Vega warnings hidden');
        },

        async freezeQueryBar() {
            const css = `
                .app-container.dshAppContainer {
                    display: flex !important;
                    flex-direction: column !important;
                    height: 1vh !important;
                }
                .dashboard-container {
                    display: flex !important;
                    flex: 1 !important;
                    overflow: hidden !important;
                }
                #dashboardViewport {
                    flex: 1 !important;
                    overflow-y: auto !important;
                }
            `;
            utils.injectStyle(css);

            try {
                const [appContainer, dashboardViewport] = await domWatchers.waitForMultipleElements([
                    '.app-container.dshAppContainer',
                    '#dashboardViewport'
                ]);

                const dashboardContainer = document.createElement('div');
                dashboardContainer.className = 'dashboard-container';
                dashboardViewport.parentNode.insertBefore(dashboardContainer, dashboardViewport);
                dashboardContainer.appendChild(dashboardViewport);

                return 'Query bar frozen';
            } catch (error) {
                throw new Error(`Failed to freeze query bar: ${error.message}`);
            }
        },

        async createTOC() {
            const tocStyles = `
                #sidebarTOC {
                    width: 150px;
                    background: var(--euiPageBackgroundColor);
                    border-right: 1px solid var(--euiBorderColor);
                    padding: 20px;
                    box-sizing: border-box;
                    font-family: var(--font-text);
                    overflow-y: auto;
                    flex-shrink: 0;
                }

                .toc-item {
                    margin-bottom: 8px;
                    padding: 8px;
                    cursor: pointer;
                    border-radius: 4px;
                    border-left: 3px solid transparent;
                    font-family: var(--font-text);
                    font-size: 14px;
                    line-height: 1.4;
                    font-weight: 400;
                    transition: background 250ms ease-in-out;
                }

                .toc-item.active {
                    background-color: rgba(var(--aa-selected-color-rgb), var(--aa-selected-color-alpha));
                    border-left-color: var(--euiBorderColor);
                    font-weight: 500;
                }

                .toc-section-title {
                    font-family: var(--font-text);
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    padding: 4px;
                    border-bottom: 1px solid var(--euiBorderColor);
                }
            `;
            utils.injectStyle(tocStyles);

            try {
                const [dashboardContainer, dashboardViewport] = await domWatchers.waitForMultipleElements([
                    '.dashboard-container',
                    '#dashboardViewport'
                ]);

                // Create sidebar but don't insert yet
                const sidebar = document.createElement('div');
                sidebar.id = 'sidebarTOC';

                // Build complete TOC structure
                const title = document.createElement('div');
                title.classList.add('toc-section-title');
                title.textContent = 'Sections';
                sidebar.appendChild(title);

                // Smooth scroll utility
                const smoothScrollTo = (targetPosition, duration = 400) => {
                    return new Promise(resolve => {
                        const startPosition = dashboardViewport.scrollTop;
                        const distance = targetPosition - startPosition;
                        let startTime = null;

                        function animation(currentTime) {
                            if (startTime === null) startTime = currentTime;
                            const timeElapsed = currentTime - startTime;
                            const progress = Math.min(timeElapsed / duration, 1);

                            const easeInOutQuad = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
                            dashboardViewport.scrollTop = startPosition + (distance * easeInOutQuad(progress));

                            if (timeElapsed < duration) {
                                requestAnimationFrame(animation);
                            } else {
                                resolve();
                            }
                        }

                        requestAnimationFrame(animation);
                    });
                };

                // Get markdown elements and build TOC items
                const markdownElements = dashboardViewport.querySelectorAll('.markdown-widget, [data-test-subj*="markdown"]');

                Array.from(markdownElements).forEach((element, index) => {
                    const text = element.textContent.trim();
                    if (!text) return;

                    const item = document.createElement('div');
                    item.classList.add('toc-item');
                    const displayText = text.split('\n')[0].substring(0, 40);
                    item.textContent = displayText || `Section ${index + 1}`;

                    item.addEventListener('click', async () => {
                        const elementRect = element.getBoundingClientRect();
                        const viewportRect = dashboardViewport.getBoundingClientRect();
                        const relativePosition = elementRect.top - viewportRect.top + dashboardViewport.scrollTop;
                        await smoothScrollTo(relativePosition - 20);
                    });

                    sidebar.appendChild(item);
                });

                // Insert fully built sidebar into DOM
                dashboardContainer.insertBefore(sidebar, dashboardViewport);

                // Update active section on scroll
                const updateActiveSection = () => {
                    const tocItems = sidebar.querySelectorAll('.toc-item');
                    const viewportRect = dashboardViewport.getBoundingClientRect();

                    let currentSectionIndex = -1;
                    markdownElements.forEach((element, index) => {
                        const elementRect = element.getBoundingClientRect();
                        const relativeTop = elementRect.top - viewportRect.top;
                        if (relativeTop <= 100) {
                            currentSectionIndex = index;
                        }
                    });

                    tocItems.forEach((item, index) => {
                        item.classList.toggle('active', index === currentSectionIndex);
                    });
                };

                // Add scroll listener
                dashboardViewport.addEventListener('scroll', updateActiveSection);
                window.addEventListener('resize', updateActiveSection);

                // Theme handling
                const updateTheme = () => {
                    const isDark = getComputedStyle(document.documentElement)
                    .getPropertyValue('color-scheme')
                    .trim() === 'dark';

                    sidebar.style.backgroundColor = isDark ? '#1D1E24' : '#F5F7FA';
                    sidebar.style.color = isDark ? '#D3DAE6' : '#343741';
                };

                // Initial theme and observer setup
                updateTheme();
                updateActiveSection();
                const themeObserver = utils.createObserver(updateTheme);
                themeObserver.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['class']
                });

                return 'TOC created successfully';
            } catch (error) {
                throw new Error(`Failed to create TOC: ${error.message}`);
            }
        }
    };

    // Main initialization
    async function initialize() {
        try {
            console.log('Initializing features...');

            // Run features in parallel where possible
            await Promise.all([
                features.hideVegaWarnings(),
                features.freezeQueryBar()
            ]);

            // Wait for markdown and create TOC
            const markdownElements = await domWatchers.waitForMarkdown();
            if (markdownElements.length > 0) {
                await features.createTOC();
            }

            console.log('All features initialized successfully');
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    }

    // Start initialization when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
