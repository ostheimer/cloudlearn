import { describe, expect, it } from "vitest";
import { isMobileUserAgent } from "./device";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const IPAD_OLD =
  "Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1";
const IPAD_MODERN =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("isMobileUserAgent (#609)", () => {
  it("erkennt Handys, die den clearn://-Link öffnen können", () => {
    expect(isMobileUserAgent(IPHONE, 5)).toBe(true);
    expect(isMobileUserAgent(ANDROID, 5)).toBe(true);
  });

  it("erkennt iPads — alte wie neue, die sich als Macintosh melden", () => {
    expect(isMobileUserAgent(IPAD_OLD, 5)).toBe(true);
    expect(isMobileUserAgent(IPAD_MODERN, 5)).toBe(true);
  });

  it("erkennt Rechner, damit dort kein toter App-Knopf steht", () => {
    expect(isMobileUserAgent(MAC, 0)).toBe(false);
    expect(isMobileUserAgent(WINDOWS, 0)).toBe(false);
  });

  it("wertet einen einzelnen Touchpunkt am Mac nicht als iPad", () => {
    // maxTouchPoints === 1 melden auch Mäuse/Trackpads in manchen Browsern.
    expect(isMobileUserAgent(MAC, 1)).toBe(false);
  });

  it("kommt ohne User-Agent zurecht", () => {
    expect(isMobileUserAgent("", 0)).toBe(false);
  });
});
