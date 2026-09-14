/**
 * What a person is offered when the agent's sign-in expires MID-CONVERSATION.
 *
 * The offer already existed — `providerState.needsLogin` turns the gear's
 * account row, the model picker and Settings into a sign-in — but every one of
 * those is somewhere else, and the welcome card that spells it out refuses to
 * paint over a live conversation on purpose. So the case this file covers is
 * the one the owner hit from a phone on 2026-09-14: a real conversation on
 * screen, the vendor's "Authentication required" in red, and no route back.
 */
import { describe, expect, it } from "vitest";
import { bootWebview, click, dispatch, type Harness } from "./webview-harness";

function boot(opts: { remote?: boolean; caps?: Record<string, unknown> } = {}) {
  const h = bootWebview({ remote: opts.remote });
  dispatch(h.window, {
    type: "initialState",
    effort: "", cwd: "/w", useCtrlEnter: false, extVersion: "4.5.2",
    showThinking: false, expandCommandOutputs: false, steerByDefault: false,
    soundNotifications: false, processingSound: false, readRepliesAloud: false,
    appPurpose: "coding",
    capabilities: opts.caps ?? { remoteAgentSignIn: true },
  } as any);
  return h;
}

const session = (h: Harness, provider: string) =>
  dispatch(h.window, { type: "session", provider, models: [], currentModelId: "model" } as any);
const providers = (h: Harness, list: unknown[]) =>
  dispatch(h.window, { type: "providerState", providers: list } as any);
const card = (h: Harness) => h.doc.getElementById("provider-signin-card");
const lapsed = (id: string) => ({ id, connected: true, needsLogin: true });

describe("the lapsed-account offer above the composer", () => {
  it("names the agent and posts the same sign-in the accounts row posts", () => {
    const h = boot();
    session(h, "claude");
    providers(h, [lapsed("claude")]);
    const el = card(h)!;
    expect(el).not.toBeNull();
    expect(el.textContent).toContain("sign in again");
    h.posted.length = 0;
    click(h.window, el.querySelector("button")!);
    expect(h.posted).toEqual([{ type: "runGrokLogin", provider: "claude" }]);
  });

  // It sits above the composer rather than replacing it, unlike the superseded
  // card. This flag is OUR bookkeeping about somebody else's credential, and
  // locking a person out of their own conversation over it is worse than one
  // more refused send.
  it("leaves the composer usable", () => {
    const h = boot();
    session(h, "claude");
    providers(h, [lapsed("claude")]);
    expect(card(h)!.parentElement!.classList.contains("composer")).toBe(true);
    expect((h.doc.getElementById("input") as HTMLTextAreaElement).disabled).toBe(false);
  });

  it("goes away the moment the account works again", () => {
    const h = boot();
    session(h, "claude");
    providers(h, [lapsed("claude")]);
    expect(card(h)).not.toBeNull();
    providers(h, [{ id: "claude", connected: true }]);
    expect(card(h)).toBeNull();
  });

  // The flag is per account; the card speaks for the session in front of you.
  // Offering "sign in to Codex" over a working Grok conversation would be an
  // interruption about something the reader is not doing.
  it("says nothing about an account this session is not using", () => {
    const h = boot();
    session(h, "grok");
    providers(h, [lapsed("codex"), { id: "grok", connected: true }]);
    expect(card(h)).toBeNull();
  });

  it("follows the session when the provider changes under it", () => {
    const h = boot();
    session(h, "grok");
    providers(h, [lapsed("claude"), { id: "grok", connected: true }]);
    expect(card(h)).toBeNull();
    session(h, "claude");
    expect(card(h)).not.toBeNull();
  });

  // An account that was never connected is the empty state's job, and that card
  // has a whole panel for choosing one. This one only ever says "again".
  it("stays out of the way of an account that was never connected", () => {
    const h = boot();
    session(h, "claude");
    providers(h, [{ id: "claude", connected: false, needsLogin: true }]);
    expect(card(h)).toBeNull();
  });

  // Capability, never a version check: a host built before remote sign-in drops
  // `runGrokLogin` silently, so a button there would do nothing at all.
  it("on a phone whose host cannot sign in, says where it can be done and offers no button", () => {
    const h = boot({ remote: true, caps: {} });
    session(h, "claude");
    providers(h, [lapsed("claude")]);
    const el = card(h)!;
    expect(el.textContent).toContain("computer running this workspace");
    expect(el.querySelector("button")).toBeNull();
  });

  it("on a phone whose host can, offers the button", () => {
    const h = boot({ remote: true, caps: { remoteAgentSignIn: true } });
    session(h, "claude");
    providers(h, [lapsed("claude")]);
    expect(card(h)!.querySelector("button")).not.toBeNull();
  });
});
