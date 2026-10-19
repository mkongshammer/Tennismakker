import { LegalPage, Section } from "../LegalPage";
import { COMPANY, EU_REPRESENTATIVE } from "../company";

export const metadata = { title: "Data Processing Agreement — RacketBuddy" };

export default function DataProcessingAgreementPage() {
  return (
    <LegalPage
      draft={false}
      title="Data Processing Agreement"
      updated="September 2, 2026"
      updatedLabel="Last updated: "
    >
      <p className="text-slate">
        This Data Processing Agreement (the <strong>“DPA”</strong>) is entered into between the club using RacketBuddy (the <strong>“Controller”</strong>) and {COMPANY.name}, a Delaware limited liability company with an address at {COMPANY.address} (the <strong>“Processor”</strong>). It applies whenever RacketBuddy processes personal data on behalf of the club and is intended to satisfy Article 28(3) of the EU General Data Protection Regulation (GDPR).
      </p>

      <Section n="1" title="Background and purpose">
        <p>
          The club uses RacketBuddy to manage club activities and services, including court availability and bookings, memberships, payments, communications, and other features selected by the club. In doing so, RacketBuddy may process personal data on the club&apos;s behalf.
        </p>
        <p>
          RacketBuddy will process personal data only on documented instructions from the club, unless processing is required by applicable law. This DPA, together with the settings and functionality selected by the club in RacketBuddy, constitutes the club&apos;s documented instructions.
        </p>
      </Section>

      <Section n="2" title="Nature and scope of the processing">
        <p><strong>Categories of data subjects:</strong> club members, guest players, coaches where applicable, and club administrators.</p>
        <p><strong>Categories of personal data:</strong> name, email address, telephone number where provided, player information, location or area information, memberships, bookings, payment history, account information, and information submitted through club administration features.</p>
        <p><strong>Purpose of processing:</strong> providing and operating the RacketBuddy services selected by the club, including account administration, booking, membership management, payment processing, access control, support, communications, and security.</p>
        <p><strong>Duration:</strong> for as long as RacketBuddy processes personal data on behalf of the club, subject to the deletion and statutory-retention provisions below.</p>
        <p>
          RacketBuddy is not intended for the processing of special categories of personal data under GDPR Article 9. The club must not intentionally submit health information or other sensitive special-category data through free-text fields or other platform features unless a separate lawful arrangement has been agreed in writing.
        </p>
        <p>
          If the club uses RacketBuddy in relation to minors, the club is responsible for ensuring that it has an appropriate legal basis and any parental or guardian permissions required by applicable law.
        </p>
      </Section>

      <Section n="3" title="Processor obligations">
        <p>RacketBuddy will:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>process personal data only on documented instructions from the club, unless otherwise required by applicable law</li>
          <li>ensure that persons authorised to process personal data are subject to appropriate confidentiality obligations</li>
          <li>implement appropriate technical and organisational measures in accordance with GDPR Article 32</li>
          <li>assist the club, taking into account the nature of the processing, with responding to data-subject requests where reasonably possible</li>
          <li>assist the club with applicable personal-data-breach obligations, data protection impact assessments, and prior consultations where reasonably required</li>
          <li>make available information reasonably necessary to demonstrate compliance with this DPA and GDPR Article 28</li>
          <li>inform the club if, in RacketBuddy&apos;s reasonable opinion, an instruction infringes applicable data-protection law</li>
        </ul>
      </Section>

      <Section n="4" title="Security measures">
        <p>
          RacketBuddy uses technical and organisational safeguards designed to protect personal data. Traffic to and from the platform is encrypted in transit, user passwords are stored using one-way password hashing, database access is restricted, and access to personal data is limited according to operational need and account permissions.
        </p>
        <p>
          Club administrators are restricted to information associated with the club they administer. RacketBuddy also uses operational logging, access controls, and hosting-provider backup and recovery measures appropriate to the service.
        </p>
      </Section>

      <Section n="5" title="Sub-processors">
        <p>The club gives RacketBuddy general authorisation to use sub-processors. Current key sub-processors include:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Render Services, Inc. — application and database hosting, including infrastructure in Frankfurt, Germany</li>
          <li>Stripe, Inc. — payment processing</li>
          <li>Resend, Inc. — transactional email delivery</li>
          <li>Expo and the relevant Apple or Google push-notification services — mobile push notifications where enabled</li>
        </ul>
        <p>
          RacketBuddy will impose data-protection obligations on sub-processors that are appropriate to the services they provide. RacketBuddy remains responsible for its obligations under this DPA where processing is performed by an authorised sub-processor.
        </p>
        <p>
          Where required by GDPR Article 28, RacketBuddy will provide reasonable notice of material additions or replacements of sub-processors so that the club can raise a reasonable data-protection objection.
        </p>
      </Section>

      <Section n="6" title="International data transfers">
        <p>
          RacketBuddy&apos;s primary application and database infrastructure is hosted in Frankfurt, Germany. Some service providers and RacketBuddy&apos;s corporate operations are located outside the EEA, including in the United States.
        </p>
        <p>
          Where personal data is transferred from the EEA to a country that does not benefit from an applicable adequacy decision, RacketBuddy will rely on a lawful transfer mechanism, such as the European Commission&apos;s Standard Contractual Clauses, together with supplementary measures where required.
        </p>
      </Section>

      <Section n="7" title="Personal data breaches">
        <p>
          RacketBuddy will notify the club without undue delay after becoming aware of a personal data breach affecting personal data processed on the club&apos;s behalf.
        </p>
        <p>
          To the extent information is available, the notification will describe the nature of the breach, the categories of data and data subjects affected, likely consequences, and measures taken or proposed to address the breach. RacketBuddy will provide reasonable assistance to help the club meet its notification obligations.
        </p>
      </Section>

      <Section n="8" title="Data-subject requests">
        <p>
          If RacketBuddy receives a request from a data subject that clearly relates to personal data processed on behalf of the club, RacketBuddy will, where appropriate, direct the request to the club or otherwise assist the club in responding. RacketBuddy will not independently determine the club&apos;s legal obligations as Controller.
        </p>
      </Section>

      <Section n="9" title="Audits and documentation">
        <p>
          On reasonable request, RacketBuddy will provide information reasonably necessary to demonstrate compliance with this DPA. The parties will first seek to satisfy audit requirements through documentation, security information, or other available evidence.
        </p>
        <p>
          If an additional audit is reasonably required under GDPR Article 28, its timing, scope, confidentiality requirements, and method will be agreed in advance so that it does not unnecessarily compromise security or disrupt the service. Unless required because of a material breach by RacketBuddy, the club will bear its own audit costs.
        </p>
      </Section>

      <Section n="10" title="Return and deletion of data">
        <p>
          When the processing relationship ends, the club may request an export of personal data that RacketBuddy processes on its behalf, where export functionality is reasonably available.
        </p>
        <p>
          RacketBuddy will then delete or anonymise personal data processed solely on the club&apos;s behalf, unless applicable law requires continued retention. Records that must be retained for accounting, tax, fraud-prevention, dispute-resolution, or other legal obligations may be retained for the required period and will remain protected during that period.
        </p>
      </Section>

      <Section n="11" title="Contact and EU representative">
        <p>
          Questions about this DPA or RacketBuddy&apos;s processing of personal data may be sent to {COMPANY.email}.
        </p>
        <p>
          For matters relating to EU data-protection law, RacketBuddy&apos;s EU representative may be contacted at {EU_REPRESENTATIVE.email}. The representative is located in Denmark.
        </p>
      </Section>

      <Section n="12" title="Term and precedence">
        <p>
          This DPA takes effect when the club starts using RacketBuddy in a manner that causes RacketBuddy to process personal data on the club&apos;s behalf and remains in force for as long as that processing continues.
        </p>
        <p>
          If this DPA conflicts with another agreement between the parties regarding the processing of personal data on the club&apos;s behalf, this DPA will prevail to the extent of that conflict.
        </p>
      </Section>
    </LegalPage>
  );
}
