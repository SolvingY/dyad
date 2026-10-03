import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Dyad" },
      {
        name: "description",
        content: "Terms of Service for Dyad, shared vitals for a human and their AI agent.",
      },
      { property: "og:title", content: "Terms of Service — Dyad" },
      {
        property: "og:description",
        content: "Terms of Service for Dyad, shared vitals for a human and their AI agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="dyad-ambient relative min-h-screen overflow-hidden">
      <main className="relative mx-auto w-full max-w-3xl px-6 pb-24 pt-10 md:pt-14">
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-light uppercase tracking-[0.45em] text-foreground/90">
            Dyad
          </h1>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/60">
            Terms of Service
          </p>
        </header>

        <article className="legal-prose mt-12">
          <p className="text-xs text-muted-foreground/70">
            Last updated: [DATE]
          </p>

          <h2>1. Agreement to Terms</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of
            Dyad (&ldquo;the Service&rdquo;), operated by [COMPANY NAME]
            (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;). By creating an
            account, accessing, or using the Service, you agree to be bound by these
            Terms and our Privacy Policy. If you do not agree to these Terms, do not
            use the Service.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be at least 18 years old (or the age of legal majority in your
            jurisdiction) to use the Service. By using the Service, you represent and
            warrant that you meet this requirement and that you have the legal
            capacity to enter into these Terms.
          </p>

          <h2>3. Description of the Service</h2>
          <p>
            Dyad is a dashboard that presents health and activity information about a
            human user alongside telemetry from that user&rsquo;s AI agent, and provides
            comparative or &ldquo;cross-analysis&rdquo; views of the two. The Service may
            display scores, gauges, and other indicators derived from data you or
            your connected devices and services provide. Unless explicitly stated in
            writing, the Service is not a medical device and does not provide
            medical advice, diagnosis, or treatment.
          </p>

          <h2>4. Your Account</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account
            credentials and for all activity that occurs under your account. You
            agree to provide accurate, current, and complete information when
            creating an account and to keep it up to date. Notify us immediately of
            any unauthorized use of your account. We are not liable for any loss or
            damage arising from your failure to protect your credentials.
          </p>

          <h2>5. Your Data and Content</h2>
          <p>
            You retain ownership of any data, content, or information you submit to
            or connect to the Service (&ldquo;Your Data&rdquo;). By using the Service, you
            grant us a limited, non-exclusive, worldwide license to host, process,
            transmit, and display Your Data solely as necessary to operate and
            provide the Service to you. We do not sell Your Data. You are solely
            responsible for the accuracy, legality, and provenance of Your Data,
            including any data you connect from third-party devices or services.
          </p>

          <h2>6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation;</li>
            <li>Submit data you do not have the right to use, including another person&rsquo;s health information without their consent;</li>
            <li>Interfere with, disrupt, or attempt to gain unauthorized access to the Service, its servers, or other users&rsquo; accounts;</li>
            <li>Reverse engineer, scrape, or extract data or code from the Service except as permitted by applicable law;</li>
            <li>Use the Service to develop a competing product or service;</li>
            <li>Harass, abuse, or harm another person through the Service.</li>
          </ul>
          <p>
            We may suspend or terminate your access to the Service if you violate
            these Terms or if we reasonably believe your use poses a security or
            legal risk.
          </p>

          <h2>7. Third-Party Services</h2>
          <p>
            The Service may integrate with third-party products, devices, and
            services (including AI agents and health platforms). Your use of any
            third-party service is subject to that third party&rsquo;s own terms and
            privacy policy. We are not responsible for the availability, accuracy,
            or content of third-party services, or for any data they provide to or
            receive from the Service.
          </p>

          <h2>8. Health and AI Disclaimers</h2>
          <p>
            <strong>Not medical advice.</strong> Content displayed in the Service —
            including scores, readiness indicators, and cross-analysis — is for
            informational purposes only and is not a substitute for professional
            medical advice, diagnosis, or treatment. Always seek the advice of a
            qualified health provider with any questions regarding a medical
            condition. Never disregard professional medical advice because of
            something displayed in the Service.
          </p>
          <p>
            <strong>AI-generated output.</strong> Where the Service presents
            information relating to, or derived from, an AI agent, that output may
            be incomplete, inaccurate, or change without notice. You should not
            rely on it as a sole source of truth for any decision.
          </p>

          <h2>9. Availability and Changes</h2>
          <p>
            We aim to keep the Service available but do not guarantee uninterrupted
            or error-free operation. We may modify, suspend, or discontinue any part
            of the Service at any time, with or without notice. We may also update
            these Terms from time to time; the &ldquo;Last updated&rdquo; date above will
            change accordingly. Material changes will be communicated through the
            Service or by other reasonable means. Your continued use of the Service
            after changes take effect constitutes acceptance of the updated Terms.
          </p>

          <h2>10. Fees and Subscriptions</h2>
          <p>
            [If the Service offers paid plans, describe pricing, billing cycles,
            renewals, refunds, and cancellation terms here. If the Service is
            currently free, you may state: &ldquo;The Service is currently provided free
            of charge. We may introduce paid plans in the future; if we do, we will
            give you advance notice and any pricing terms before charging
            you.&rdquo;]
          </p>

          <h2>11. Termination</h2>
          <p>
            You may stop using the Service and delete your account at any time. We
            may suspend or terminate your account or access to the Service, with or
            without notice, if you breach these Terms or if we discontinue the
            Service. Upon termination, the license you granted us to Your Data
            ends, and we will handle Your Data as described in our Privacy Policy.
            Sections that by their nature should survive termination (including
            ownership, disclaimers, and limitations of liability) shall survive.
          </p>

          <h2>12. Disclaimers</h2>
          <p>
            THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo;
            WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY,
            INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
            PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE
            SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE, OR THAT ANY
            INFORMATION DISPLAYED WILL BE ACCURATE OR RELIABLE.
          </p>

          <h2>13. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL WE BE LIABLE
            FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
            DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, GOODWILL, OR OTHER
            INTANGIBLE LOSSES, ARISING OUT OF OR RELATED TO YOUR USE OF (OR
            INABILITY TO USE) THE SERVICE. OUR TOTAL AGGREGATE LIABILITY FOR ALL
            CLAIMS SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12)
            MONTHS PRECEDING THE CLAIM, OR USD 100 IF YOU HAVE NOT PAID US ANY
            AMOUNTS. SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO PARTS
            OF THIS SECTION MAY NOT APPLY TO YOU.
          </p>

          <h2>14. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless [COMPANY NAME] and its
            officers, directors, employees, and agents from any claims, damages,
            losses, and expenses (including reasonable attorneys&rsquo; fees) arising
            out of or related to your use of the Service, Your Data, or your
            violation of these Terms.
          </p>

          <h2>15. Governing Law and Disputes</h2>
          <p>
            These Terms are governed by the laws of [JURISDICTION], without regard
            to conflict-of-law principles. Any dispute arising out of or relating
            to these Terms or the Service shall be brought exclusively in the
            courts located in [VENUE], unless applicable law provides otherwise.
            Before filing suit, the parties agree to attempt in good faith to
            resolve the dispute informally for at least 30 days after written
            notice of the dispute.
          </p>

          <h2>16. Entire Agreement</h2>
          <p>
            These Terms, together with our Privacy Policy, constitute the entire
            agreement between you and us regarding the Service and supersede any
            prior agreements or understandings. If any provision of these Terms is
            found unenforceable, the remaining provisions remain in full force.
          </p>

          <h2>17. Contact</h2>
          <p>
            Questions about these Terms? Contact us at [CONTACT EMAIL].
          </p>
        </article>

        <footer className="mt-16 flex items-center justify-center gap-4 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/60">
          <a href="/terms" className="transition-colors hover:text-foreground/80">
            Terms
          </a>
          <span aria-hidden="true" className="size-1 rounded-full bg-glass-line-luminous" />
          <a href="/privacy" className="transition-colors hover:text-foreground/80">
            Privacy
          </a>
          <span aria-hidden="true" className="size-1 rounded-full bg-glass-line-luminous" />
          <a href="/" className="transition-colors hover:text-foreground/80">
            Dashboard
          </a>
        </footer>
      </main>
    </div>
  );
}
