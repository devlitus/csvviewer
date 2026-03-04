import {
  SHOWING_ROWS_SELECTOR,
  TOTAL_RECORDS_SELECTOR,
  DELIMITER_BADGE_SELECTOR,
} from "../utils/domSelectors";

/**
 * Display names for supported delimiters
 */
const DELIMITER_DISPLAY_NAMES: Record<string, string> = {
  ",": "Comma (,)",
  ";": "Semicolon (;)",
  "\t": "Tab",
};

/**
 * Updates toolbar counters (showing X rows from Y total) and delimiter badge.
 */
export class ToolbarRenderer {
  private showingElement: HTMLElement | null;
  private totalElement: HTMLElement | null;
  private delimiterElement: HTMLElement | null;

  constructor(
    showingSelector: string = SHOWING_ROWS_SELECTOR,
    totalSelector: string = TOTAL_RECORDS_SELECTOR,
    delimiterSelector: string = DELIMITER_BADGE_SELECTOR
  ) {
    this.showingElement = document.querySelector(showingSelector);
    if (!this.showingElement) {
      console.warn(`[ToolbarRenderer] Showing rows element not found for selector: "${showingSelector}"`);
    }
    this.totalElement = document.querySelector(totalSelector);
    if (!this.totalElement) {
      console.warn(`[ToolbarRenderer] Total records element not found for selector: "${totalSelector}"`);
    }
    this.delimiterElement = document.querySelector(delimiterSelector);
    if (!this.delimiterElement) {
      console.warn(`[ToolbarRenderer] Delimiter badge element not found for selector: "${delimiterSelector}"`);
    }
  }

  /**
   * Update toolbar counters.
   *
   * @param showingRows - Number of rows being shown on current page
   * @param totalRecords - Total number of records in dataset
   */
  update(showingRows: number, totalRecords: number): void {
    if (this.showingElement) {
      this.showingElement.textContent = showingRows.toString();
    }
    if (this.totalElement) {
      this.totalElement.textContent = totalRecords.toLocaleString();
    }
  }

  /**
   * Update delimiter badge text based on detected delimiter.
   *
   * @param delimiter - The delimiter character (or string)
   */
  updateDelimiter(delimiter: string): void {
    if (!this.delimiterElement) return;

    const displayText = DELIMITER_DISPLAY_NAMES[delimiter] ?? delimiter;
    this.delimiterElement.textContent = displayText;
  }
}
