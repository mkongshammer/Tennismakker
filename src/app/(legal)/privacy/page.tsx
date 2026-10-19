import { LegalPage, Section } from "../LegalPage";
import { COMPANY, EU_REPRESENTATIVE } from "../company";

export const metadata = { title: "Privacy Policy — RacketBuddy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      draft={false}
      title="Privacy Policy"
      updated="September 22, 2026"
      updatedLabel="Last updated: "
    >
      <Section n="1" title="Data controller">
        <p>
          {COMPANY.name}, registered in the State of Delaware, USA, with its address at {COMPANY.address}, is the data controller for the personal data you provide when you create a profile and use the platform.
        </p>
        <p>
          If you have questions about how we process your personal data, you can contact us at {COMPANY.email}.
        </p>
        <p>
          Because the company is established outside the EU, we have appointed an EU representative under Article 27 of the GDPR. If you are located in the EU, you may contact {EU_REPRESENTATIVE.name}, Denmark, at {EU_REPRESENTATIVE.email} directly regarding your personal data.
        </p>
        <p>
          If you use the platform as a member of a club, the club is an independent data controller for the personal data it processes about you. In that context, RacketBuddy acts as a data processor for the club.
        </p>
      </Section>

      <Section n="2" title="Personal data we process">
        <p>We may process the following information about you:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Name, email address and, where provided, phone number</li>
          <li>Your playing level and area</li>
          <li>Your bookings and payment history</li>
          <li>Content you create on the platform</li>
          <li>Technical information such as IP address and login timestamps</li>
          <li>If you ask to be told when courts or coaches open in an area: your email address, the sport and place you asked about, and a one-way, salted fingerprint of your network address used only to detect abuse. We send one confirmation email, one notification when matching supply goes live, and nothing else. Every email carries an unsubscribe link that deletes the record.</li>
        </ul>
        <p>
          We do not store your payment card details. Payments are handled by Stripe, Inc., which acts as an independent controller for payment data where applicable.
        </p>
      </Section>

      <Section n="3" title="How we use your personal data">
        <p>
          <strong>To perform our agreement with you</strong> (GDPR Article 6(1)(b)): to create and maintain your profile, process bookings, send receipts and enable communication between users.
        </p>
        <p>
          <strong>To comply with legal obligations</strong> (Article 6(1)(c)): for example, accounting rules may require us to retain certain financial records for five years.
        </p>
        <p>
          <strong>For our legitimate interests</strong> (Article 6(1)(f)): to operate and secure the platform, prevent misuse, support users and improve the service, where those interests are not overridden by your rights and interests.
        </p>
      </Section>

      <Section n="4" title="Who we share personal data with">
        <p>
          If you book a court, we may share your name, email address and booking details with the relevant club so it can provide the booking and any required access. If you book a coaching session, the corresponding information may be shared with the coach.
        </p>
        <p>
          If you choose to connect with another player through the platform, information you choose to provide may be shared as necessary to enable that interaction.
        </p>
        <p>
          We use service providers including Render Services, Inc. for hosting and infrastructure, Stripe, Inc. for payments, and Resend, Inc. for transactional email. Where required, appropriate data processing agreements are in place.
        </p>
        <p>We do not sell your personal data or use it for third-party advertising.</p>
      </Section>

      <Section n="5" title="International data transfers">
        <p>
          Our application servers and database are hosted in Frankfurt, Germany. RacketBuddy is operated by a U.S. company, and some service providers, including Stripe and Resend, may process data in the United States. Where required, international transfers are protected through recognized transfer mechanisms such as the European Commission&apos;s Standard Contractual Clauses and the relevant providers&apos; transfer frameworks.
        </p>
      </Section>

      <Section n="6" title="How long we keep personal data">
        <p>
          Your profile is retained for as long as you have an account. If you delete your account, profile information is deleted within 30 days, except where we are legally required to keep specific records for longer.
        </p>
        <p>
          Booking and payment records may be retained for five years after the end of the relevant financial year where required by accounting law.
        </p>
        <p>Closed player posts may be deleted after 12 months.</p>
        <p>Court and coach notification requests that are never confirmed are deleted after 30 days; confirmed requests are deleted 180 days after the notification has been sent, or immediately when you unsubscribe.</p>
      </Section>

      <Section n="7" title="Children and young people">
        <p>
          The platform is intended for users aged 18 and over. If you are under 18, a parent or legal guardian must create the profile and be responsible for the booking.
        </p>
        <p>
          If we become aware that we hold personal data about a child under 18 without the required parental or guardian involvement, we will delete it as soon as reasonably possible. Contact us at {COMPANY.email} if you believe this applies.
        </p>
      </Section>

      <Section n="8" title="Your rights">
        <p>Depending on applicable law, you may have the right to:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>access the personal data we hold about you</li>
          <li>correct inaccurate personal data</li>
          <li>request deletion where we no longer have a lawful reason to retain the data</li>
          <li>request restriction of processing</li>
          <li>receive certain personal data in a machine-readable format</li>
          <li>object to processing based on legitimate interests</li>
        </ul>
        <p>
          Contact {COMPANY.email} to exercise your rights. We aim to respond within one month where the GDPR applies. You can also delete your account directly from your profile in RacketBuddy.
        </p>
        <p>
          If you are located in Denmark and are dissatisfied with how we handle your personal data, you may lodge a complaint with the Danish Data Protection Agency (Datatilsynet), Carl Jacobsens Vej 35, 2500 Valby, Denmark.
        </p>
      </Section>

      <Section n="9" title="Cookies">
        <p>
          We use a strictly necessary cookie to keep you signed in. This cookie does not require consent because the service cannot function without it.
        </p>
        <p>
          We do not use cookies for advertising, cross-site tracking or marketing analytics. We may count page views in aggregate by day without storing a tracking cookie, IP address or a record of the specific pages viewed in a way that identifies you.
        </p>
      </Section>

      <Section n="10" title="Security">
        <p>
          Passwords are stored using one-way password hashing and cannot be read back by us. Traffic to and from the platform is encrypted in transit, and access to personal data is limited to people who need it for their work.
        </p>
        <p>
          If a personal data breach creates a risk to individuals, we will notify the relevant supervisory authority within the time limits required by applicable law and notify affected users directly where the risk is high.
        </p>
      </Section>

      <Section n="11" title="Push notifications in the mobile app">
        <p>
          If you enable push notifications, we store your device push token and notification preferences. We use Expo and Apple or Google push notification services to send notifications about bookings, reminders, coaching requests and unread messages. Push notifications do not include the content of your chat, payment card details or club access credentials.
        </p>
        <p>
          You can change your notification preferences or disable push notifications from your profile. Device registration is removed when you log out or delete your account and otherwise expires with your login session. Technical delivery records are removed after 30 days. Your device settings also control whether notifications are displayed.
        </p>
      </Section>
    </LegalPage>
  );
}
