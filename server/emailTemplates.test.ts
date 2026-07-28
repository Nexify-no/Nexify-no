/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * Admin-editable e-mail copy.
 *
 * Handing an admin the text of a password-reset e-mail is only safe if two things
 * are true, and these tests are those two things:
 *
 *   1. The built-in copy wins whenever ANYTHING is wrong. No row, disabled,
 *      invalid, a placeholder that resolved to empty, an exception — every one of
 *      those sends the original e-mail. A customer locked out because somebody
 *      mistyped a template is not an acceptable failure mode.
 *
 *   2. Admin-authored markup and substituted VALUES are treated differently.
 *      The body is sanitised (it may contain formatting); the values are escaped
 *      (they may not). Getting that backwards is how a support reply becomes a
 *      working phishing link inside a genuine Penna e-mail — which is exactly
 *      what `sendSupportTicketReplyEmail` used to do with raw `${replyMessage}`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeDb, type FakeDb } from "./testing/fakeDb";
import { mkCtx } from "./testing/ctx";

let fake: FakeDb;

/**
 * Outbound mail, captured. Module scope because `vi.mock` factories are hoisted
 * above anything declared inside a `describe`.
 */
let sent: Array<{ to: string; subject: string; html: string }> = [];

vi.mock("@sendgrid/mail", () => ({
  default: {
    setApiKey: () => undefined,
    send: async (msg: { to: string; subject: string; html: string }) => {
      sent.push({ to: msg.to, subject: msg.subject, html: msg.html });
      return [{ statusCode: 202 }];
    },
  },
}));

vi.mock("./db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./db")>()),
  getDb: async () => fake.db,
}));

/** A stored override row, as `getOverride` would read it. */
function overrideRow(over: Record<string, unknown> = {}) {
  return {
    id: 1,
    templateKey: "password_reset",
    name: "Tilbakestill passord",
    subject: "Nytt passord",
    bodyHtml: '<p>Hei {{name}},</p><p><a href="{{resetLink}}">Velg nytt passord</a></p>',
    ctaLabel: null,
    ctaHref: null,
    kind: "override",
    enabled: 1,
    updatedAt: new Date(),
    ...over,
  };
}

describe("validateTemplate", () => {
  it("refuses a password reset that dropped its link", async () => {
    // The single most important rule in the file. Without {{resetLink}} the
    // e-mail is a friendly note to a locked-out customer.
    const { validateTemplate, findBuiltIn } = await import("./services/emailTemplates");
    const errors = validateTemplate({
      name: "x",
      subject: "Nytt passord",
      bodyHtml: "<p>Hei {{name}}, ta kontakt med support.</p>",
      builtIn: findBuiltIn("password_reset"),
    });
    expect(errors.some((e) => e.message.includes("{{resetLink}}"))).toBe(true);
  });

  it("accepts the link wherever it appears — body, subject or button", async () => {
    const { validateTemplate, findBuiltIn } = await import("./services/emailTemplates");
    const builtIn = findBuiltIn("password_reset");
    const inButton = validateTemplate({
      name: "x",
      subject: "Nytt passord",
      bodyHtml: "<p>Hei {{name}}</p>",
      ctaLabel: "Velg nytt passord",
      ctaHref: "{{resetLink}}",
      builtIn,
    });
    expect(inButton).toEqual([]);
  });

  it("refuses the statutory reminder without its cancellation link", async () => {
    // digitalytelsesloven is specifically about telling people how to stop paying.
    // The wording is the admin's; the way out is not optional.
    const { validateTemplate, findBuiltIn } = await import("./services/emailTemplates");
    const errors = validateTemplate({
      name: "x",
      subject: "Abonnementet ditt",
      bodyHtml: "<p>Takk for at du er kunde!</p>",
      builtIn: findBuiltIn("subscription_active_reminder"),
    });
    expect(errors.some((e) => e.message.includes("{{billingUrl}}"))).toBe(true);
  });

  it("catches a misspelled variable before it ships as literal text", async () => {
    const { validateTemplate, findBuiltIn } = await import("./services/emailTemplates");
    const errors = validateTemplate({
      name: "x",
      subject: "Hei",
      bodyHtml: "<p>Hei {{firstname}}, her er {{resetLink}}</p>",
      builtIn: findBuiltIn("password_reset"),
    });
    expect(errors.some((e) => e.message.includes("{{firstname}}"))).toBe(true);
  });

  it("refuses an empty body — it is indistinguishable from a successful send", async () => {
    const { validateTemplate } = await import("./services/emailTemplates");
    for (const body of ["", "   ", "<p></p>", "<p>&nbsp;</p>"]) {
      expect(validateTemplate({ name: "x", subject: "y", bodyHtml: body })).toContainEqual(
        expect.objectContaining({ field: "body" })
      );
    }
  });

  it("refuses half a button", async () => {
    const { validateTemplate } = await import("./services/emailTemplates");
    const labelOnly = validateTemplate({
      name: "x", subject: "y", bodyHtml: "<p>z</p>", ctaLabel: "Trykk her",
    });
    expect(labelOnly.some((e) => e.field === "ctaHref")).toBe(true);
    const hrefOnly = validateTemplate({
      name: "x", subject: "y", bodyHtml: "<p>z</p>", ctaHref: "https://penna.no",
    });
    expect(hrefOnly.some((e) => e.field === "ctaHref")).toBe(true);
  });

  it("refuses a javascript: button now, rather than dropping it silently later", async () => {
    const { validateTemplate } = await import("./services/emailTemplates");
    const errors = validateTemplate({
      name: "x",
      subject: "y",
      bodyHtml: "<p>z</p>",
      ctaLabel: "Trykk",
      ctaHref: "javascript:alert(1)",
    });
    expect(errors.some((e) => e.field === "ctaHref")).toBe(true);
  });
});

describe("substitution keeps markup and values apart", () => {
  it("escapes a value, so a customer's text cannot become markup", async () => {
    // The support-reply injection: a reply body that renders as a real link
    // inside a real Penna e-mail is a phishing primitive we hand out ourselves.
    const { substitute } = await import("./services/emailTemplates");
    const out = substitute("<p>{{replyText}}</p>", {
      replyText: '<a href="http://evil.example/">Tilbakestill passordet ditt</a>',
    });
    expect(out).not.toContain("<a href");
    expect(out).toContain("&lt;a href");
  });

  it("keeps the admin's own markup", async () => {
    const { renderStored } = await import("./services/emailTemplates");
    const r = renderStored(
      { subject: "s", bodyHtml: "<p><strong>Hei</strong> {{name}}</p>", ctaLabel: null, ctaHref: null },
      { name: "Tamer" }
    );
    expect(r.bodyHtml).toContain("<strong>Hei</strong>");
    expect(r.bodyHtml).toContain("Tamer");
  });

  it("strips a script the sanitiser should never let through", async () => {
    const { renderStored } = await import("./services/emailTemplates");
    const r = renderStored(
      { subject: "s", bodyHtml: '<p>ok</p><script>fetch("/x")</script>', ctaLabel: null, ctaHref: null },
      {}
    );
    expect(r.bodyHtml).not.toContain("<script");
  });

  it("does not escape the subject — a reader should see & not &amp;", async () => {
    const { substitutePlain } = await import("./services/emailTemplates");
    expect(substitutePlain("{{planName}} & mer", { planName: "Pro" })).toBe("Pro & mer");
  });

  it("leaves an unknown placeholder visible instead of blanking the sentence", async () => {
    const { substitute } = await import("./services/emailTemplates");
    expect(substitute("<p>Hei {{nope}}</p>", { name: "x" })).toContain("{{nope}}");
  });

  it("resolves a placeholder inside the button href", async () => {
    const { renderStored } = await import("./services/emailTemplates");
    const r = renderStored(
      { subject: "s", bodyHtml: "<p>x</p>", ctaLabel: "Velg nytt passord", ctaHref: "{{resetLink}}" },
      { resetLink: "https://penna.no/reset-password?token=abc" }
    );
    expect(r.ctaHref).toContain("penna.no/reset-password");
    expect(r.ctaLabel).toBe("Velg nytt passord");
  });

  it("drops a button whose resolved href is not http(s)", async () => {
    const { renderStored } = await import("./services/emailTemplates");
    const r = renderStored(
      { subject: "s", bodyHtml: "<p>x</p>", ctaLabel: "Trykk", ctaHref: "{{link}}" },
      { link: "javascript:alert(1)" }
    );
    expect(r.ctaHref).toBeUndefined();
    // No orphan label either — a button with no target is a dead end.
    expect(r.ctaLabel).toBeUndefined();
  });
});

describe("the built-in copy is the fallback for every failure", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("uses the built-in when there is no override", async () => {
    const { renderOverride } = await import("./services/emailTemplates");
    expect(await renderOverride("password_reset", { resetLink: "https://penna.no/r" })).toBeNull();
  });

  it("uses the built-in when the override is switched off", async () => {
    fake = createFakeDb({ rows: { email_templates: [overrideRow({ enabled: 0 })] } });
    const { renderOverride } = await import("./services/emailTemplates");
    expect(await renderOverride("password_reset", { resetLink: "https://penna.no/r" })).toBeNull();
  });

  it("uses the built-in when the stored row no longer passes validation", async () => {
    // The registry's rules can tighten in a later release while a row saved under
    // the old rules sits in the database. Re-checked at SEND time, not just save.
    fake = createFakeDb({
      rows: { email_templates: [overrideRow({ bodyHtml: "<p>Ta kontakt med support.</p>" })] },
    });
    const { renderOverride } = await import("./services/emailTemplates");
    expect(await renderOverride("password_reset", { resetLink: "https://penna.no/r" })).toBeNull();
  });

  it("uses the built-in when a required value resolves to empty", async () => {
    // A template that contains {{resetLink}} but is handed an empty link produces
    // a broken e-mail just as surely as one that omits it.
    fake = createFakeDb({ rows: { email_templates: [overrideRow()] } });
    const { renderOverride } = await import("./services/emailTemplates");
    expect(await renderOverride("password_reset", { resetLink: "" })).toBeNull();
    expect(await renderOverride("password_reset", { resetLink: undefined })).toBeNull();
  });

  it("uses the built-in when the database throws", async () => {
    fake = createFakeDb({ failOn: { email_templates: new Error("table missing") } });
    const { renderOverride } = await import("./services/emailTemplates");
    expect(await renderOverride("password_reset", { resetLink: "https://penna.no/r" })).toBeNull();
  });

  it("renders the override when everything is in order", async () => {
    fake = createFakeDb({ rows: { email_templates: [overrideRow()] } });
    const { renderOverride } = await import("./services/emailTemplates");
    const r = await renderOverride("password_reset", {
      name: "Tamer",
      resetLink: "https://penna.no/reset-password?token=abc",
    });
    expect(r).not.toBeNull();
    expect(r!.subject).toBe("Nytt passord");
    expect(r!.bodyHtml).toContain("Tamer");
    expect(r!.bodyHtml).toContain("penna.no/reset-password");
  });
});

describe("saving a template", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("refuses an inlined base64 image with a reason", async () => {
    // The sanitiser strips `data:` URIs, so without this the picture would vanish
    // between pressing Save and looking at the result, with no explanation.
    const { saveTemplate } = await import("./services/emailTemplates");
    await expect(
      saveTemplate({
        templateKey: null,
        name: "Kampanje",
        subject: "Hei",
        bodyHtml: '<p>Se her:</p><img src="data:image/png;base64,iVBORw0KGgo=" />',
        adminUserId: 1,
      })
    ).rejects.toThrow(/limes inn direkte|base64/i);
  });

  it("stores the sanitised body, not what was submitted", async () => {
    const { saveTemplate } = await import("./services/emailTemplates");
    await saveTemplate({
      templateKey: null,
      name: "Kampanje",
      subject: "Hei",
      bodyHtml: '<p onclick="steal()">Hei</p><script>steal()</script>',
      adminUserId: 1,
    });
    const stored = String(
      (fake.onlyOp("insert", "email_templates").values as Record<string, unknown>).bodyHtml
    );
    expect(stored).not.toContain("<script");
    expect(stored).not.toContain("onclick");
    expect(stored).toContain("Hei");
  });

  it("refuses an unknown built-in key rather than creating a dead override", async () => {
    const { saveTemplate } = await import("./services/emailTemplates");
    await expect(
      saveTemplate({
        templateKey: "not_a_real_email",
        name: "x",
        subject: "y",
        bodyHtml: "<p>z</p>",
        adminUserId: 1,
      })
    ).rejects.toThrow(/Ukjent mal-nøkkel/);
  });

  it("records who changed it", async () => {
    const { saveTemplate } = await import("./services/emailTemplates");
    await saveTemplate({
      templateKey: null,
      name: "Kampanje",
      subject: "Hei",
      bodyHtml: "<p>Hei</p>",
      adminUserId: 42,
    });
    const v = fake.onlyOp("insert", "email_templates").values as Record<string, unknown>;
    expect(v.updatedByUserId).toBe(42);
    expect(v.kind).toBe("custom");
  });
});

describe("the template endpoints are admin-only", () => {
  beforeEach(() => {
    fake = createFakeDb();
  });

  it("rejects an ordinary user everywhere", async () => {
    const { appRouter } = await import("./routers");
    const c = appRouter.createCaller(mkCtx(9));
    await expect(c.admin.listEmailTemplates()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      c.admin.saveEmailTemplate({ name: "x", subject: "y", bodyHtml: "<p>z</p>" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      c.admin.resetEmailTemplate({ templateKey: "welcome" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(c.admin.deleteEmailTemplate({ id: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      c.admin.sendTestEmailTemplate({ subject: "y", bodyHtml: "<p>z</p>" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      c.admin.uploadEmailImage({ fileName: "a.png", fileData: "x", contentType: "image/png" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuses a test send when e-mail is not configured, instead of claiming success", async () => {
    // The specific lie the old "Send Notification" button told.
    const prev = process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_API_KEY;
    try {
      const { appRouter } = await import("./routers");
      const admin = appRouter.createCaller(mkCtx(1, { role: "admin" }));
      await expect(
        admin.admin.sendTestEmailTemplate({ subject: "Hei", bodyHtml: "<p>Hei</p>" })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    } finally {
      if (prev !== undefined) process.env.SENDGRID_API_KEY = prev;
    }
  });

  it("every listed built-in is actually wired to a sender", async () => {
    // The previous version of this test asserted that the substring
    // `withOverride(\n    "welcome"` appeared in email.ts. That proved a string
    // existed in a file. It survived a mutation that replaced the fallback with
    // infinite recursion, and it broke when prettier reflowed the call. Assert on
    // the parsed set of keys instead, which is what "wired" actually means.
    const { readFileSync } = await import("node:fs");
    const { BUILT_IN_TEMPLATES } = await import("./services/emailTemplates");
    const src = readFileSync("server/_core/email.ts", "utf8");
    const wired = new Set(
      [...src.matchAll(/withOverride\(\s*"([a-z0-9_]+)"/g)].map((m) => m[1])
    );
    expect([...wired].sort()).toEqual(BUILT_IN_TEMPLATES.map((t) => t.key).sort());
  });

  it("no built-in sender calls itself instead of its built-in body", async () => {
    // A fallback of `() => sendWelcomeEmail(...)` rather than
    // `() => sendWelcomeEmailBuiltIn(...)` recurses forever and sends nothing,
    // while every string-matching test still passes.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("server/_core/email.ts", "utf8");
    for (const m of src.matchAll(
      /export async function (send\w+Email)\(([\s\S]{0,1200}?)\n\}/g
    )) {
      const [, name, body] = m;
      if (!body.includes("withOverride(")) continue;
      const fallback = body.match(/\(\) =>\s*(send\w+)\(/);
      expect(fallback, `${name} has no fallback call`).not.toBeNull();
      expect(fallback![1], `${name} falls back to itself`).not.toBe(name);
      expect(fallback![1], `${name}'s fallback is not a BuiltIn function`).toMatch(/BuiltIn$/);
    }
  });

  it("every customer value interpolated into a built-in body is escaped", async () => {
    // The old assertions looked for `>${name}<`, which never appears — the real
    // source is `<p>Hei ${name},</p>`. So they passed on unescaped code, and a
    // mutation reverting `esc(name)` kept all 28 green.
    //
    // Assert POSITIVELY, and only inside the HTML: every `${…}` in an e-mail body
    // must go through `esc(`, or be one of the server-authored values named below.
    // Scanning the whole file instead would flag console.log lines and comments.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("server/_core/email.ts", "utf8");

    const htmlBodies = [...src.matchAll(/htmlContent = `([\s\S]*?)\n {2}`;/g)].map((m) => m[1]);
    expect(htmlBodies.length, "no HTML bodies found — did the file shape change?").toBeGreaterThan(
      8
    );

    /**
     * Values that are safe raw because the SERVER produces them, not a customer:
     * links we build, a day count computed from a Date, an id from our own table.
     */
    const SERVER_AUTHORED =
      /^(siteUrl\(\)|site|verifyLink|resetLink|ticketId|days|days === 1 \? "dag" : "dager"|stats\.postsGenerated|stats\.postsPublished|stats\.totalEngagement|isAdminReply \? .*)$/;

    const offenders: string[] = [];
    for (const body of htmlBodies) {
      for (const m of body.matchAll(/\$\{([^}]+)\}/g)) {
        const expr = m[1].trim();
        if (expr.startsWith("esc(") || SERVER_AUTHORED.test(expr)) continue;
        offenders.push(expr);
      }
    }
    expect(offenders, `unescaped in an e-mail body: ${offenders.join(" | ")}`).toEqual([]);
  });
});

/**
 * `withOverride` itself — the headline invariant, previously untested.
 *
 * Every "the built-in is the fallback" test above targets `renderOverride`
 * returning null. Not one checked that anything ACTS on that null. A mutation
 * replacing `return fallback()` with `return true` — so `sendPasswordResetEmail`
 * reports success and sends nothing at all — left all 28 tests green.
 */
describe("withOverride acts on the fallback", () => {
  beforeEach(() => {
    sent = [];
    fake = createFakeDb();
    process.env.SENDGRID_API_KEY = "test-key";
  });

  it("sends the BUILT-IN password reset when there is no override", async () => {
    const { sendPasswordResetEmail } = await import("./_core/email");
    const ok = await sendPasswordResetEmail(
      "kunde@example.com",
      "Tamer",
      "https://penna.no/reset-password?token=abc"
    );
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
    // The built-in copy, verbatim — not a template, and not nothing.
    expect(sent[0].subject).toBe("Tilbakestill passord");
    expect(sent[0].html).toContain("Tilbakestill Passord");
    expect(sent[0].html).toContain("token=abc");
  });

  it("sends the OVERRIDE when one is in force", async () => {
    fake = createFakeDb({
      rows: {
        email_templates: [
          {
            id: 1,
            templateKey: "password_reset",
            name: "Tilbakestill passord",
            subject: "Nytt passord til {{name}}",
            bodyHtml: '<p>Hei {{name}}</p><p><a href="{{resetLink}}">Velg nytt</a></p>',
            ctaLabel: null,
            ctaHref: null,
            kind: "override",
            enabled: 1,
            updatedAt: new Date(),
          },
        ],
      },
    });
    const { sendPasswordResetEmail } = await import("./_core/email");
    await sendPasswordResetEmail("kunde@example.com", "Tamer", "https://penna.no/r?token=xyz");
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe("Nytt passord til Tamer");
    expect(sent[0].html).toContain("Velg nytt");
    expect(sent[0].html).toContain("token=xyz");
  });

  it("still sends the built-in when the override is broken", async () => {
    // A template that dropped {{resetLink}}. The customer must still get a link.
    fake = createFakeDb({
      rows: {
        email_templates: [
          {
            id: 1,
            templateKey: "password_reset",
            name: "x",
            subject: "Hei",
            bodyHtml: "<p>Ta kontakt med support.</p>",
            ctaLabel: null,
            ctaHref: null,
            kind: "override",
            enabled: 1,
            updatedAt: new Date(),
          },
        ],
      },
    });
    const { sendPasswordResetEmail } = await import("./_core/email");
    await sendPasswordResetEmail("kunde@example.com", "Tamer", "https://penna.no/r?token=fallback");
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("token=fallback");
    expect(sent[0].subject).toBe("Tilbakestill passord");
  });

  it("sends exactly one e-mail, never both", async () => {
    // `sendEmail` returns false rather than throwing, so a careless `catch` around
    // the override path could fall through and send twice.
    fake = createFakeDb({
      rows: {
        email_templates: [
          {
            id: 1,
            templateKey: "welcome",
            name: "Velkommen",
            subject: "Velkommen!",
            bodyHtml: "<p>Hei {{name}}</p>",
            ctaLabel: null,
            ctaHref: null,
            kind: "override",
            enabled: 1,
            updatedAt: new Date(),
          },
        ],
      },
    });
    const { sendWelcomeEmail } = await import("./_core/email");
    await sendWelcomeEmail("kunde@example.com", "Tamer");
    expect(sent).toHaveLength(1);
  });

  it("escapes a customer's name in the built-in body", async () => {
    // `<p>Hei ${name},</p>` was raw. A display name is customer-controlled.
    const { sendWelcomeEmail } = await import("./_core/email");
    await sendWelcomeEmail("kunde@example.com", '<img src=x onerror="alert(1)">');
    expect(sent[0].html).not.toContain("<img src=x");
    expect(sent[0].html).toContain("&lt;img src=x");
  });

  it("escapes a support reply — the one that was a live phishing vector", async () => {
    const { sendSupportTicketReplyEmail } = await import("./_core/email");
    await sendSupportTicketReplyEmail(
      "kunde@example.com",
      "Tamer",
      42,
      '<a href="http://evil.example/">Tilbakestill passordet ditt</a>',
      true
    );
    expect(sent[0].html).not.toContain('href="http://evil.example/"');
    expect(sent[0].html).toContain("&lt;a href");
  });
});

describe("renderStored end to end", () => {
  it("does not escape the subject on the way through renderStored", async () => {
    // Tested in isolation before, never through renderStored — so swapping
    // substitutePlain for substitute there (subjects reading `Pro &amp; mer`)
    // passed every test.
    const { renderStored } = await import("./services/emailTemplates");
    // The escapable character has to be in the VALUE, not the literal — `substitute`
    // only touches what it substitutes, so `"{{x}} & mer"` comes out identical
    // either way and a test built on that cannot tell the two apart.
    const r = renderStored(
      { subject: "Kvittering: {{planName}}", bodyHtml: "<p>x</p>", ctaLabel: null, ctaHref: null },
      { planName: "Pro & Co «Norge»" }
    );
    expect(r.subject).toBe("Kvittering: Pro & Co «Norge»");
    expect(r.subject).not.toContain("&amp;");
  });

  it("escapes the button label — it lands in the shell unfiltered", async () => {
    // `pennaEmailShell` interpolates the label as `>${label}<`, so this is the one
    // stored field with no filter of its own. A label of
    // `Klikk</a><a href="http://evil/">Nytt passord</a>` would put a second,
    // attacker-chosen link inside a genuine, DKIM-signed Penna e-mail.
    const { renderStored } = await import("./services/emailTemplates");
    const r = renderStored(
      {
        subject: "s",
        bodyHtml: "<p>x</p>",
        ctaLabel: 'Klikk</a><a href="http://evil.example/">Nytt passord</a>',
        ctaHref: "https://penna.no",
      },
      {}
    );
    expect(r.ctaLabel).not.toContain("<a href");
    expect(r.ctaLabel).toContain("&lt;/a&gt;");
  });
});
