export interface CertificationLesson {
	id: string
	title: string
	body: string
}

export interface CertificationModule {
	id: string
	title: string
	lessons: CertificationLesson[]
}

export const CERTIFICATION_MODULES: CertificationModule[] = [
	{
		id: "m1",
		title: "Module 1 — Introduction",
		lessons: [
			{
				id: "1.1",
				title: "1.1 What is Quanby Legal",
				body: `Quanby Legal (qLegal) is an accredited electronic notarization platform aligned with Supreme Court rules for Electronic Notary Publics (ENPs). It connects principals who need notarized instruments with certified ENPs through secure remote or in-person electronic sessions, preserving identity assurance, audit trails, and directory visibility once you are commission-active.`,
			},
			{
				id: "1.2",
				title: "1.2 Key Terminology",
				body: `Principal — the person executing the instrument. ENP — Electronic Notary Public using an accredited facility. REN — Remote Electronic Notarization using audiovisual technology. IEN — In-Person Electronic Notarization with the principal physically before the notary. Electronic notarial register — the durable record of each act required under A.M. No. 24-10-14-SC.`,
			},
			{
				id: "1.3",
				title: "1.3 Course Objectives",
				body: `By the end of this course you should understand qLegal dashboards and services, how principals and witnesses participate, the difference between remote and in-person electronic acts, and the legal/compliance framing that underpins the certification exam.`,
			},
		],
	},
	{
		id: "m2",
		title: "Module 2 — Platform Dashboards",
		lessons: [
			{
				id: "2.1",
				title: "2.1 Principal Dashboard",
				body: `Clients use the principal experience to find certified ENPs, request appointments, exchange messages, upload instruments for review, and join secured sessions when an act is scheduled. Status tiles highlight onboarding, KYC (when applicable), and upcoming commitments.`,
			},
			{
				id: "2.2",
				title: "2.2 ENP Dashboard",
				body: `Your ENP dashboard surfaces certification status, commission progress with the Supreme Court, KYC checkpoints, appointment inbox, QuickSign shortcuts, and registry tools. Use it as the control center between onboarding completion and SC activation.`,
			},
		],
	},
	{
		id: "m3",
		title: "Module 3 — Core Services",
		lessons: [
			{
				id: "3.1",
				title: "3.1 Remote vs In-Person Notarization",
				body: `Remote Electronic Notarization requires verified identity, audiovisual presence, and compliance with Court protocol for cross-border or domestic sessions as permitted. In-Person Electronic Notarization couples physical presence with electronic seals, certificates, and registers. Choose the mode allowed for the instrument and jurisdiction.`,
			},
			{
				id: "3.2",
				title: "3.2 Live Session & Identity Verification",
				body: `Live sessions synchronize video, document presentation, and evidence capture. Identity verification pairs government ID validation with liveness to mitigate impersonation — consistent with BSP eKYC guidance and Court expectations for REN.`,
			},
		],
	},
	{
		id: "m4",
		title: "Module 4 — Stakeholder Roles",
		lessons: [
			{
				id: "4.1",
				title: "4.1 Principal, ENP, and Witness",
				body: `The principal acknowledges or swears to the instrument. The ENP verifies identity, confirms voluntariness, applies the electronic certificate, and maintains the register entry. Witnesses, when required, provide credible participation consistent with notarial rules and session recordings.`,
			},
		],
	},
	{
		id: "m5",
		title: "Module 5 — Compliance",
		lessons: [
			{
				id: "5.1",
				title: "5.1 Legal Framework",
				body: `Key references include A.M. No. 24-10-14-SC (electronic notarization), RA 8792 (Electronic Commerce Act), RA 10173 (Data Privacy Act), and BSP Circular 944 on digital onboarding/eKYC standards. Expect exam questions drawn from these instruments and implementing rules.`,
			},
			{
				id: "5.2",
				title: "5.2 Security Protocols",
				body: `Security spans encryption in transit and at rest, tamper-evident logs, least-privilege access, retention schedules aligned with the ten-year register duty, and breach notification duties under the NPC when personal data is involved.`,
			},
		],
	},
]
