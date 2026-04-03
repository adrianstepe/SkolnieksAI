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
          Pēdējo reizi atjaunināts: <strong>2026. gada aprīlī</strong>
        </p>

        {/* 1 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">1. Pakalpojuma apraksts</h2>
        <p className="mb-6">
          SkolnieksAI ir mākslīgā intelekta (MI) palīgmācību rīks, kas palīdz skolēniem saprast mācību vielu,
          uzdot jautājumus un nostiprināt zināšanas. SkolnieksAI <strong>nav</strong> skolotāja, privātskolotāja
          vai jebkuras izglītības iestādes aizstājējs. Platforma ir paredzēta kā papildinājums mācoties, nevis
          kā galvenais mācību avots. Galīgos lēmumus par mācībām, vērtējumiem un karjeru pieņem skolotāji,
          vecāki un paši skolēni, nevis SkolnieksAI.
        </p>

        {/* 2 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">2. Lietošanas noteikumi</h2>
        <p className="mb-6">
          Reģistrējoties platformā, Tu piekrīt lietot SkolnieksAI godprātīgi un atbildīgi. Tas nozīmē:
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li>
            <strong>Neiesniegt AI atbildes kā savas:</strong> Aizliegts kopēt SkolnieksAI ģenerētās atbildes
            un iesniegt tās skolā, augstskolā vai jebkurā citā vietā kā savu patstāvīgo darbu. SkolnieksAI
            ir paredzēts, lai <em>palīdzētu saprast</em>, nevis lai veiktu darbu tavā vietā.
          </li>
          <li>
            <strong>Neapiet ierobežojumus:</strong> Aizliegts mēģināt apiet bezmaksas pieprasījumu limitus,
            izveidojot vairākus kontus vai izmantojot automatizētus skriptus un robotus.
          </li>
          <li>
            <strong>Nelietot API ļaunprātīgi:</strong> Aizliegts veikt masveida automatizētus pieprasījumus,
            kas pārslogo mūsu serverus vai traucē citiem lietotājiem.
          </li>
          <li>
            <strong>Ievērot vispārīgos lietošanas principus:</strong> Aizliegts lūgt AI ģenerēt pretlikumīgu,
            kaitīgu vai apvainojošu saturu.
          </li>
        </ul>
        <p className="mb-6">
          Pārkāpumu gadījumā mēs paturam tiesības apturēt vai dzēst kontu bez iepriekšēja brīdinājuma.
        </p>

        {/* 3 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">3. AI ierobežojumi</h2>
        <p className="mb-6">
          MI modeļi dažreiz kļūdās. SkolnieksAI sniegtās atbildes var būt neprecīzas, nepilnīgas vai novecojušas.
          Lūdzu, pārbaudi svarīgu informāciju citos avotos — mācību grāmatās, pie skolotājiem vai uzticamās
          tīmekļa vietnēs.
        </p>
        <ul className="list-disc pl-5 space-y-2 mb-6">
          <li>SkolnieksAI atbildes <strong>nav</strong> uzskatāmas par oficiāliem mācību materiāliem.</li>
          <li>
            Tās <strong>nav</strong> apstiprinātas, pārskatītas vai ieteiktas ne Valsts izglītības satura centram
            (VISC), ne Izglītības un zinātnes ministrijai (IZM), ne jebkurai citai izglītības iestādei.
          </li>
          <li>
            SkolnieksAI nav atbildīgs par akademiskajiem rezultātiem vai lēmumiem, kas pieņemti, balstoties uz
            AI sniegtajām atbildēm.
          </li>
        </ul>

        {/* 4 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">4. Abonementa noteikumi</h2>
        <p className="mb-6">
          Maksājumus droši apstrādā <strong>Stripe, Inc.</strong> Mēs nepiekļūstam Tavas maksājumu kartes
          datiem un tos nesaglabājam. Abonementi atjaunojas automātiski katru mēnesi, ja vien tos neanulē.
          Norādītajās cenās ir iekļauts PVN, ja tas attiecas uz pirkumu saskaņā ar Latvijas nodokļu likumdošanu.
        </p>
        <p className="mb-3 font-medium text-text-primary">Pieejamie tarifi:</p>
        <ul className="list-disc pl-5 space-y-3 mb-6">
          <li>
            <strong>Bezmaksas</strong> — ierobežots mēneša pieprasījumu skaits, pamata AI modelis (DeepSeek).
            Piemērots neregulārai lietošanai.
          </li>
          <li>
            <strong>Pro</strong> — lielāks pieprasījumu limits, prioritāras atbildes un piekļuve uzlabotiem AI
            modeļiem (Claude). Piemērots aktīviem skolēniem.
          </li>
          <li>
            <strong>Premium</strong> — neierobežota lietošana, visi AI modeļi, eksāmenu sagatavošanas rīki un
            prioritārs atbalsts. Piemērots eksāmenu sezonai un intensīvām mācībām.
          </li>
        </ul>
        <p className="mb-6">
          Abonementu var anulēt jebkurā laikā sadaļā <Link href="/settings/cancel" className="text-primary hover:underline">Iestatījumi → Atcelt abonementu</Link>.
          Pēc anulēšanas piekļuve saglabājas līdz apmaksātā perioda beigām. Maksa par daļēji izmantotu mēnesi
          netiek atmaksāta, izņemot gadījumus, kas norādīti zemāk (skat. 5. punktu).
        </p>

        {/* 5 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">5. Atteikuma tiesības</h2>
        <p className="mb-6">
          Saskaņā ar ES Patērētāju tiesību direktīvu Tev ir tiesības atteikties no līguma <strong>14 dienu</strong> laikā
          no abonēšanas brīža bez jebkāda pamatojuma.
        </p>
        <p className="mb-6">
          <strong>Izņēmums digitālajam saturam:</strong> Ja Tu esi skaidri piekritis(-usi) pakalpojuma tūlītējai
          izmantošanai un atzinis(-usi), ka tādējādi zaudē atteikuma tiesības, atteikuma tiesības vairs netiek
          piemērotas. Reģistrējoties un uzsākot pakalpojuma lietošanu, Tu apliecini, ka esi informēts(-a) par šo
          izņēmumu.
        </p>
        <p className="mb-6">
          Lai izmantotu atteikuma tiesības pirms pakalpojuma uzsākšanas vai noskaidrotu atbilstību, raksti mums
          uz <a href="mailto:info@skolnieksai.lv" className="text-primary hover:underline">info@skolnieksai.lv</a> vai
          izmanto <Link href="/settings/cancel" className="text-primary hover:underline">atcelšanas lapu</Link>.
        </p>

        {/* 6 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">6. Intelektuālais īpašums</h2>
        <p className="mb-6">
          SkolnieksAI platforma, tās dizains, logotips, nosaukums un oriģinālais saturs ir <strong>SIA Stepe Digital</strong> intelektuālais
          īpašums. Tos aizliegts kopēt, izplatīt vai izmantot komerciālos nolūkos bez rakstiskas atļaujas.
        </p>
        <p className="mb-6">
          Skola2030 mācību programmas saturs, uz kuru platforma var atsaukties, pieder tā attiecīgajiem
          tiesību īpašniekiem. SkolnieksAI izmanto šo saturu vienīgi informatīvos nolūkos saskaņā ar
          piemērojamajiem autortiesību ierobežojumiem. SkolnieksAI nav saistīts ar VISC, IZM vai Skola2030
          projektu, un neapgalvo, ka tā ir officiāla to mājasvieta.
        </p>

        {/* 7 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">7. Datu aizsardzība</h2>
        <p className="mb-6">
          Mēs apstrādājam personas datus saskaņā ar GDPR un Latvijas Fizisko personu datu apstrādes likumu.
          Pilnu informāciju par to, kādus datus mēs vācam un kā tos izmantojam, lasi mūsu{" "}
          <Link href="/privacy" className="text-primary hover:underline">Privātuma politikā</Link>.
        </p>

        {/* 8 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">8. Atbildības ierobežojumi</h2>
        <p className="mb-6">
          SkolnieksAI tiek nodrošināts "tāds, kāds ir" (<em>as is</em>). Mēs cenšamies nodrošināt stabilu
          darbību, taču negarantējam nepārtrauktu pieejamību vai atbilžu precizitāti. Tehnisku problēmu,
          apkopes vai neparedzētu apstākļu dēļ pakalpojums var būt īslaicīgi nepieejams.
        </p>
        <p className="mb-6">
          SkolnieksAI atbildība ir ierobežota līdz abonementa maksas apmēram, ko Lietotājs samaksājis
          attiecīgajā mēnesī. Mēs neatbildam par netiešiem zaudējumiem, t.sk. akademiskiem rezultātiem vai
          nokavētiem termiņiem.
        </p>

        {/* 9 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">9. Piemērojamie likumi</h2>
        <p className="mb-6">
          Šos noteikumus regulē Latvijas Republikas tiesību normas. Jebkuri strīdi, kas rodas saistībā ar
          šiem noteikumiem, tiek izskatīti Latvijas Republikas tiesās pēc SIA Stepe Digital juridiskās
          adreses. Ja Tu esi patērētājs ES dalībvalstī, Tev paliek spēkā arī savas valsts patērētāju
          aizsardzības tiesību normas.
        </p>

        {/* 10 */}
        <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">10. Kontaktinformācija</h2>
        <p className="mb-2">
          Ja Tev ir jautājumi, sūdzības vai vēlies izmantot savas tiesības, sazinieties ar mums:
        </p>
        <ul className="list-none pl-0 space-y-1 mb-6">
          <li><strong>Uzņēmums:</strong> SIA Stepe Digital</li>
          <li><strong>Adrese:</strong> Gulbene, Latvija</li>
          <li>
            <strong>E-pasts:</strong>{" "}
            <a href="mailto:info@skolnieksai.lv" className="text-primary hover:underline">
              info@skolnieksai.lv
            </a>
          </li>
        </ul>
      </div>
    </main>
  );
}
