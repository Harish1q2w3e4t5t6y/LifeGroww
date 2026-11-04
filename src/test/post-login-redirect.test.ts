import { describe, it, expect, beforeEach } from "vitest";
import { savePostLoginRedirect, getPostLoginRedirect, clearPostLoginRedirect } from "@/lib/postLoginRedirect";

describe("post-login redirect", () => {
  beforeEach(() => sessionStorage.clear());

  it("remembers a same-site path until cleared", () => {
    savePostLoginRedirect("/oauth/consent?authorization_id=abc");
    expect(getPostLoginRedirect()).toBe("/oauth/consent?authorization_id=abc");
    clearPostLoginRedirect();
    expect(getPostLoginRedirect()).toBeNull();
  });

  it("refuses other sites", () => {
    savePostLoginRedirect("//evil.example/x");
    savePostLoginRedirect("https://evil.example/x");
    expect(getPostLoginRedirect()).toBeNull();
  });

  it("expires after 15 minutes", () => {
    savePostLoginRedirect("/oauth/consent?authorization_id=abc", 0);
    expect(getPostLoginRedirect(14 * 60 * 1000)).not.toBeNull();
    expect(getPostLoginRedirect(16 * 60 * 1000)).toBeNull();
  });
});
