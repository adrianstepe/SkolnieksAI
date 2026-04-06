import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privātuma politika — SkolnieksAI",
  description: "SkolnieksAI privātuma politika un datu apstrādes noteikumi.",
};

export default function PrivacyPolicyPage() {
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
          Privātuma politika
        </h1>
      </div>

      <div className="prose prose-invert prose-primary max-w-none text-text-secondary">
        <p className="text-sm border-l-2 border-primary pl-4 py-1 bg-primary/5 rounded-r">
          Pēdējo reizi atjaunināts: <strong>2026. gada maijā</strong>
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">1. Ievads</h2>
        <p className="mb-6">
          Šī Privātuma politika skaidro, kā SkolnieksAI (&quot;mēs&quot;, &quot;mūsu&quot;) vāc, izmanto un aizsargā jūsu personas datus,
          izmantojot mūsu platformu un pakalpojumus. Mēs esam apņēmušies ievērot Vispārīgo datu aizsardzības regulu (GDPR)
          un Latvijas Republikas likumdošanu.
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">2. Dati, ko mēs vācam</h2>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li><strong>Konta informācija:</strong> e-pasta adrese, vārds (ja nodrošināts), reģistrācijas datums un parole (šifrētā veidā, caur Firebase Auth).</li>
          <li><strong>Demogrāfiskie dati:</strong> izvēlētā klase (lai pielāgotu atbilžu saturu), vecuma apstiprinājums (13 gadi vai vecāku atļauja).</li>
          <li><strong>Mācību dati un saturs:</strong> jūsu uzdotie jautājumi, atbildes un sarunu vēsture. Šie dati tiek izmantoti TIKAI, lai nodrošinātu jums pakalpojumu.</li>
          <li><strong>Tehniskā un lietošanas informācija:</strong> IP adrese, pārlūkprogrammas tips, ierīces informācija un platformas izmantošanas statistika (kopējais jautājumu skaits, pierakstīšanās laiki).</li>
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">3. Kā mēs izmantojam jūsu datus</h2>
        <p className="mb-6">
          Jūsu dati tiek izmantoti tikai, lai:
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li>Nodrošinātu, uzturētu un uzlabotu SkolnieksAI pakalpojumus (Mākslīgā intelekta modeļu atbilžu kvalitātes analīze).</li>
          <li>Apstrādātu maksājumus (šos datus droši apstrādā Stripe, mēs nesaglabājam jūsu kartes datus).</li>
          <li>Garantētu drošību un novērstu ļaunprātīgu sistēmas izmantošanu.</li>
          <li>Nodrošinātu klientu atbalstu.</li>
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">4. Datu kopīgošana ar trešajām pusēm</h2>
        <p className="mb-6">
          Mēs nekad nepārdodam jūsu datus! Mēs izmantojam sekojošos drošus partnerus pakalpojuma nodrošināšanai:
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li><strong>Firebase (Google cloud):</strong> Datu bāzes, serveru, lietotāju autentifikācijas un drošības nodrošināšanai.</li>
          <li><strong>DeepSeek / Anthropic (Claude):</strong> Jautājumu apstrādei. <em>Uzmanību:</em> Šiem partneriem netiek nodota jūsu personiskā informācija (vārds, epasts), tikai anonimizēts jautājuma teksts, kas nepieciešams atbildes ģenerēšanai. Turklāt šie partneri nedrīkst izmantot platformā uzdotos jautājumus savu AI modeļu apmācībai saskaņā ar B2B API noteikumiem.</li>
          <li><strong>Stripe:</strong> Maksājumu un norēķinu datu drošai apstrādei.</li>
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">5. Bērnu privātums</h2>
        <p className="mb-6">
          Mūsu pakalpojumi ir paredzēti skolēniem, un mēs ievērojam īpašu piesardzību. Personām, kuras nav sasniegušas 
          13 gadu vecumu, reģistrācija ir atļauta tikai ar vecāka vai aizbildņa piekrišanu saskaņā ar spēkā esošajiem likumiem. 
          Ja mēs atklāsim, ka esam nejauši savākuši datus no personas, kas jaunāka par 13 gadiem (bez attiecīgās piekrišanas), mēs 
          šos datus nekavējoties dzēsim.
        </p>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">6. Jūsu tiesības (GDPR)</h2>
        <p className="mb-6">
          Jums ir pilnas tiesības:
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li>Piekļūt saviem personas datiem.</li>
          <li>Būt aizmirstam (pieprasīt pilnīgu visu datu izdzēšanu, sūtot e-pastu mums).</li>
          <li>Labot neprecīzus datus.</li>
          <li>Ierobežot datu apstrādi.</li>
        </ul>

        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">7. Saziņa</h2>
        <p className="mb-6">
          Ja jums ir jautājumi par šo privātuma politiku, lūdzu sazinies ar mums pa e-pastu: <a href="mailto:privacy@stepe.digital" className="text-primary hover:underline">privacy@stepe.digital</a>
        </p>
      </div>
    </main>
  );
}
