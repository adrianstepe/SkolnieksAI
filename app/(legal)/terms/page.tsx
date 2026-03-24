import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lietošanas noteikumi — SkolnieksAI",
  description: "SkolnieksAI pakalpojumu lietošanas noteikumi un vienošanās.",
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 md:py-20 text-text-primary selection:bg-primary/20">
      <div className="mb-10 flex items-center gap-3">
        <Link 
          href="/" 
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface border border-border transition-colors hover:bg-surface-hover hover:text-primary-custom text-text-muted"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-3xl font-bold text-primary-custom">
          Lietošanas noteikumi
        </h1>
      </div>

      <div className="prose prose-invert prose-primary max-w-none text-text-secondary">
        <p className="text-sm border-l-2 border-primary pl-4 py-1 bg-primary/5 rounded-r">
          Pēdējo reizi atjaunināts: <strong>2026. gada maijā</strong>
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">1. Vispārīgie Noteikumi</h2>
        <p className="mb-6">
          Šie Lietošanas noteikumi (turpmāk "Noteikumi") nosaka kārtību, kādā SIA "Stepe Digital" (turpmāk 
          "Mēs", "SkolnieksAI") nodrošina pakalpojumus vietnē SkolnieksAI. Reģistrējoties un izmantojot 
          platformu, Lietotājs (vai tā likumiskais pārstāvis) piekrīt šiem noteikumiem pilnā apmērā.
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">2. Reģistrācija un Vecuma Ierobežojums</h2>
        <p className="mb-6">
          Lai izmantotu platformu, Lietotājam ir jāizveido konts. Lietotājs ir atbildīgs par konta 
          drošību un konfidencialitāti. Pakalpojums ir pieejams personām, kuras sasniegušas 13 gadu 
          vecumu, VAI ar vecāku/aizbildņu atļauju saskaņā ar Latvijas un ES likumdošanu. Ja mēs konstatēsim 
          pārkāpumu, reģistrācija var tikt dzēsta liedzot piekļuvi pakalpojumiem bez brīdinājuma.
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">3. Pakalpojuma Būtība un Lietošana</h2>
        <p className="mb-6">
          SkolnieksAI sniedz izglītojošu palīdzību, izmantojot lielo valodu modeļus (AI). Informācija tiek 
          ģenerēta automatizēti, pamatojoties uz Skola2030 mācību materiāliem, bet mēs negarantējam
          atbilžu 100% precizitāti.
        </p>
        <p className="mb-6">Lietotājs apņemas:</p>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li>Neizmantot platformu pretlikumīgām darbībām, apvainojoša satura ģenerēšanai vai sistēmas uzlaušanai.</li>
          <li>Pieņemt pilnu atbildību par mājasdarbu un eksāmenu izpildi – SkolnieksAI kalpo KĀ PALĪGS, nevis
          izpildītājs tavā vietā. Neesam atbildīgi par skolā saņemtajiem vērtējumiem.</li>
          <li>Neveikt darbības (automatizētu skriptu sūtīšana, masveida jautājumi datoriālā veidā), 
          kas pārmērīgi noslogo mūsu un sadarbības partneru serverus.</li>
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">4. Maksas Pakalpojumi (Abonementi)</h2>
        <p className="mb-6">
          Papildu un regulāra izmantošana iespējama iegādājoties Premium vai Eksāmenu Sagatavošanas abonementu.
          Maksājumus apstrādā Stripe, Inc. Abonementi automātiski atjaunojas katru mēnesi.
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li>Abonementu iespējams jebkurā laikā anulēt sadaļā "Iestatījumi".</li>
          <li>Pēc anulēšanas jūs saglabājat Premium piekļuvi līdz apmaksātā mēneša perioda beigām.</li>
          <li>Maksa par jau uzsāktu un neizmantotu mēnesi netiek atmaksāta.</li>
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">5. Atbildības Ierobežojumi</h2>
        <p className="mb-6">
          Mēs pieliekam visas pūles 24/7 pieejamībai, taču paturam tiesības īslaicīgi apstādināt sistēmas
          darbību uzturēšanai un servisa problēmu risināšanai bez iepriekšēja brīdinājuma un kompensācijām par to.
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">6. Izmaiņas Noteikumos</h2>
        <p className="mb-6">
          Mēs paturam tiesības jebkurā laikā mainīt šos Noteikumus. Izmaiņas stājas spēkā ar to 
          publicēšanas brīdi vietnē. Turpinot lietot pakalpojumu, Lietotājs piekrīt mainītajiem noteikumiem.
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">7. Saziņa</h2>
        <p className="mb-6">
          Sūdzību, pieteikumu vai atbalsta gadījumos vērsties pie mums pa e-pastu: <a href="mailto:hello@stepe.digital" className="text-primary hover:underline">hello@stepe.digital</a>
        </p>
      </div>
    </main>
  );
}
