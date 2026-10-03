import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Dyad" },
      {
        name: "description",
        content: "Privacy Policy for Dyad, shared vitals for a human and their AI agent.",
      },
      { property: "og:title", content: "Privacy Policy — Dyad" },
      {
        property: "og:description",
        content: "Privacy Policy for Dyad, shared vitals for a human and their AI agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="dyad-ambient relative min-h-screen overflow-hidden">
      <main className="relative mx-auto w-full max-w-3xl px-6 pb-24 pt-10 md:pt-14">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-light uppercase tracking-[0.45em] text-foreground">
            Dyad
          </h1>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
            Privacy Policy
          </p>
        </header>

        <article className="legal-prose mt-12">
          <p className="text-xs text-muted-foreground">
            Last updated: [DATE]
          </p>

          <h2>1. Overview</h2>
          <p>
            This Privacy Policy describes how [COMPANY NAME] (&ldquo;we&rdquo;,
            &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses, and shares information
            when you use Dyad (&ldquo;the Service&rdquo;), a dashboard that pairs human
            vitals with AI agent telemetry. By using the Service, you agree to the
            practices described in this policy.
          </p>

          <h2>2. Information We Collect</h2>
          <h3>Information you provide</h3>
          <ul>
            <li><strong>Account information.</strong> Name, email address, and password when you create an account.</li>
            <li><strong>Profile and preferences.</strong> Display name, preferences, and settings you configure in the Service.</li>
            <li><strong>Support communications.</strong> Information you send us when contacting support or providing feedback.</li>
          </ul>
          <h3>Information you connect or sync</h3>
          <ul>
            <li><strong>Health and activity data.</strong> Data from sources you choose to connect (for example, wearable devices or health platforms), such as heart rate, sleep, activity, or other vitals.</li>
            <li><strong>Agent telemetry.</strong> Data relating to your AI agent that you connect or configure, such as activity logs, status, or performance metrics.</li>
          </ul>
          <h3>Information collected automatically</h3>
          <ul>
            <li><strong>Usage data.</strong> Pages viewed, features used, and interactions with the Service.</li>
            <li><strong>Device and log data.</strong> IP address, browser type, device identifiers, operating system, and server logs.</li>
            <li><strong>Cookies and similar technologies.</strong> Small files used to keep you signed in, remember preferences, and understand usage. See Section 7.</li>
          </ul>

          <h2>3. How We Use Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Operate, maintain, and provide the Service, including displaying scores, gauges, and cross-analysis views;</li>
            <li>Create and manage your account and authenticate you;</li>
            <li>Improve the Service, develop new features, and fix problems;</li>
            <li>Monitor usage, detect fraud, and keep the Service secure;</li>
            <li>Communicate with you about the Service, including service updates, security notices, and (with your consent) marketing;</li>
            <li>Comply with legal obligations and enforce our Terms of Service.</li>
          </ul>
          <p>
            We do not use your health or vitals data for advertising, and we do not
            sell your personal information.
          </p>

          <h2>4. Legal Bases for Processing (EEA/UK)</h2>
          <p>
            If you are located in the EEA or UK, we process your personal data on
            the following legal bases: performance of a contract (to provide the
            Service you signed up for); legitimate interests (to secure and improve
            the Service, provided these are not overridden by your rights); consent
            (for optional cookies and marketing communications, where required);
            and legal obligation (where processing is required by law).
          </p>

          <h2>5. How We Share Information</h2>
          <p>We share information only in these circumstances:</p>
          <ul>
            <li><strong>Service providers.</strong> Vendors that host our infrastructure, process payments, or help us operate the Service (for example, cloud hosting and authentication providers), bound by contract to process data only on our instructions.</li>
            <li><strong>Integrations you enable.</strong> If you connect third-party services (devices, health platforms, or AI agents), data flows between the Service and those services as you direct.</li>
            <li><strong>Legal requirements.</strong> Where required by law, legal process, or to protect the rights, property, or safety of us, our users, or the public.</li>
            <li><strong>Business transfers.</strong> In connection with a merger, acquisition, or sale of assets, with notice to you where required by law.</li>
          </ul>
          <p>
            We do not sell personal information, and we do not share health data
            for third-party advertising.
          </p>

          <h2>6. Data Retention</h2>
          <p>
            We keep personal information for as long as your account is active or
            as needed to provide the Service. When you delete your account, we
            delete or de-identify your personal information within [RETENTION
            PERIOD, e.g. 30/90 days], except where we must retain it for legal,
            security, or legitimate business purposes (such as tax records or
            fraud prevention), in which case it is retained only for that purpose.
          </p>

          <h2>7. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies for essential functions (sign-in
            sessions, security) and, with your consent, for analytics. You can
            control cookies through your browser settings; blocking essential
            cookies may prevent parts of the Service from working.
          </p>

          <h2>8. Your Rights and Choices</h2>
          <p>
            Depending on your location, you may have some or all of the following
            rights over your personal information:
          </p>
          <ul>
            <li>Access a copy of the personal information we hold about you;</li>
            <li>Correct inaccurate information;</li>
            <li>Delete your account and personal information;</li>
            <li>Export your data in a portable, machine-readable format;</li>
            <li>Object to or restrict certain processing, or withdraw consent where processing is based on consent;</li>
            <li>Lodge a complaint with your local data protection authority.</li>
          </ul>
          <p>
            California residents have the right to know what personal information
            is collected, and the right to delete and correct personal information,
            as described in the CCPA/CPRA as amended. We do not sell or share
            personal information as defined by those laws.
          </p>
          <p>
            To exercise any right, contact us at [CONTACT EMAIL]. We will respond
            within the timeframe required by applicable law. We will not
            discriminate against you for exercising your rights.
          </p>

          <h2>9. Security</h2>
          <p>
            We use industry-standard safeguards to protect your information,
            including encryption in transit (TLS) and at rest, access controls, and
            row-level security in our database. No method of transmission or
            storage is completely secure, and we cannot guarantee absolute
            security. Please use a strong, unique password and keep your
            credentials confidential.
          </p>

          <h2>10. International Transfers</h2>
          <p>
            Your information may be processed in countries other than your own,
            including the United States, where data protection laws may differ. We
            rely on appropriate safeguards (such as Standard Contractual Clauses)
            for transfers of personal data from the EEA, UK, or Switzerland.
          </p>

          <h2>11. Children&rsquo;s Privacy</h2>
          <p>
            The Service is not directed to children under 18 (or the age of legal
            majority in your jurisdiction), and we do not knowingly collect
            personal information from them. If you believe a minor has provided us
            personal information, contact us at [CONTACT EMAIL] and we will delete
            it.
          </p>

          <h2>12. Sensitive Data</h2>
          <p>
            Health and vitals data is sensitive. We treat it accordingly: it is
            used only to provide the features you enable, is not used for
            advertising, and is not sold. You can disconnect a data source or
            delete synced data at any time from your account settings.
          </p>

          <h2>13. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. The
            &ldquo;Last updated&rdquo; date above shows the current version. Material
            changes will be communicated through the Service or by other
            reasonable means before they take effect.
          </p>

          <h2>14. Contact</h2>
          <p>
            Questions about this Privacy Policy or our data practices? Contact us
            at [CONTACT EMAIL].
          </p>
        </article>

        <footer className="mt-16 flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          <a href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </a>
          <span aria-hidden="true" className="size-1 rounded-full bg-glass-line-luminous" />
          <a href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </a>
          <span aria-hidden="true" className="size-1 rounded-full bg-glass-line-luminous" />
          <a href="/" className="transition-colors hover:text-foreground">
            Dashboard
          </a>
        </footer>
      </main>
    </div>
  );
}
