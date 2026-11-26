"""
Banc hors réseau du lecteur de Sheet (lot 2, 26/11/2026).

Moteur commun — fichier : moteur/editorial/test_lire_sheet.py
Lancé par : .github/workflows/lire-sheet.yml, AVANT la vraie lecture.

On fabrique un faux Sheet à partir de la copie actuelle (sites/<SITE>/editorial)
et on vérifie, dans un dossier jetable :
  1. relire le Sheet tel quel ne change aucune ligne (seule la date bouge) ;
  2. une ligne disparue du Sheet est GARDÉE dans la copie ;
  3. une ligne modifiée dans le Sheet est bien mise à jour ;
  4. un onglet vide fait ÉCHOUER la lecture et ne touche à aucun fichier ;
  5. sans secret Google, la lecture échoue sans toucher à aucun fichier.
Juge au code de sortie : 0 = tout conforme, 1 = au moins un écart.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import shutil
import sys
import tempfile

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.dirname(os.path.dirname(ICI))   # moteur/editorial/ -> racine du dépôt
sys.path.insert(0, ICI)
import lire_sheet as L  # noqa: E402

SITE = os.environ.get("SITE", "").strip()
if not SITE:
    sys.exit("La variable SITE est obligatoire (le dossier du site dans sites/).")
ecarts: list[str] = []


def verdict(ok: bool, nom: str, detail: str = "") -> None:
    print(f"  {'✅' if ok else '❌'} {nom}" + (f" — {detail}" if detail else ""))
    if not ok:
        ecarts.append(nom)


class FauxOnglet:
    def __init__(self, title, values):
        self.title, self._v = title, values

    def get_all_values(self):
        return copy.deepcopy(self._v)


class FauxSheet:
    def __init__(self, onglets):
        self._o = onglets

    def worksheets(self):
        return self._o


def copie_jetable() -> str:
    d = tempfile.mkdtemp(prefix="lire_sheet_")
    os.makedirs(os.path.join(d, "sites", SITE))
    shutil.copy(os.path.join(RACINE, "sites", SITE, "manifest.yml"),
                os.path.join(d, "sites", SITE, "manifest.yml"))
    shutil.copytree(os.path.join(RACINE, "sites", SITE, "editorial"),
                    os.path.join(d, "sites", SITE, "editorial"))
    return d


def empreintes(d: str) -> dict:
    e = {}
    dossier = os.path.join(d, "sites", SITE, "editorial")
    for f in sorted(os.listdir(dossier)):
        with open(os.path.join(dossier, f), "rb") as fh:
            e[f] = hashlib.sha256(fh.read()).hexdigest()
    return e


def lire(d: str, page: str) -> dict:
    with open(os.path.join(d, "sites", SITE, "editorial", f"{page}.json"), encoding="utf-8") as fh:
        return json.load(fh)


def faux_sheet_depuis(d: str, retouche=None) -> FauxSheet:
    """Un onglet par page, rempli avec les lignes de la copie actuelle."""
    man = L._load_manifest(d, SITE)
    _, pages, _ = L._page_config(man)
    onglets = []
    for p in pages:
        recs = lire(d, p["name"])["records"]
        cols = []
        for r in recs:
            for k in r:
                if k not in cols:
                    cols.append(k)
        grille = [cols] + [[str(r.get(c, "")) if r.get(c) is not None else "" for c in cols] for r in recs]
        if retouche:
            grille = retouche(p["name"], grille)
        onglets.append(FauxOnglet(p["tab"], grille))
    return FauxSheet(onglets)


def main() -> int:
    print(f"Banc du lecteur de Sheet — site {SITE}")

    # 1. Relecture à l'identique
    d = copie_jetable()
    avant = {p: lire(d, p)["records"] for p in ["glossary", "acronyms", "annuaire", "history", "brands", "blog"]}
    L.pull(SITE, root=d, _sheet_opener=lambda _id: faux_sheet_depuis(d))
    apres = {p: lire(d, p)["records"] for p in avant}
    diff = [p for p in avant if avant[p] != apres[p]]
    verdict(not diff, "1. relire le Sheet tel quel ne change aucune ligne",
            f"pages modifiées : {diff}" if diff else f"{sum(len(v) for v in avant.values())} lignes identiques")
    shutil.rmtree(d)

    # 2 et 3. Ligne disparue gardée, ligne modifiée mise à jour (glossaire)
    d = copie_jetable()
    g = lire(d, "glossary")["records"]
    disparu, modifie = g[0]["id"], g[1]["id"]

    def retouche(page, grille):
        if page != "glossary":
            return grille
        cols = grille[0]
        i_id, i_desc = cols.index("id"), cols.index("description_en")
        out = [cols]
        for ligne in grille[1:]:
            if ligne[i_id] == disparu:
                continue
            if ligne[i_id] == modifie:
                ligne = list(ligne)
                ligne[i_desc] = "TEXTE MODIFIÉ PAR LE BANC"
            out.append(ligne)
        return out

    L.pull(SITE, root=d, _sheet_opener=lambda _id: faux_sheet_depuis(d, retouche))
    g2 = {r["id"]: r for r in lire(d, "glossary")["records"]}
    verdict(disparu in g2, "2. une ligne disparue du Sheet est gardée", f"id {disparu}")
    verdict(g2.get(modifie, {}).get("description_en") == "TEXTE MODIFIÉ PAR LE BANC",
            "3. une ligne modifiée est mise à jour", f"id {modifie}")
    shutil.rmtree(d)

    # 4. Onglet vide = échec, aucun fichier touché
    d = copie_jetable()
    e0 = empreintes(d)

    def vide(page, grille):
        return [grille[0]] if page == "history" else grille

    try:
        L.pull(SITE, root=d, _sheet_opener=lambda _id: faux_sheet_depuis(d, vide))
        echoue = False
    except L.EditorialError:
        echoue = True
    verdict(echoue and empreintes(d) == e0, "4. un onglet vide fait échouer sans rien écrire")
    shutil.rmtree(d)

    # 5. Sans secret Google : échec, aucun fichier touché
    d = copie_jetable()
    e0 = empreintes(d)
    sauve = os.environ.pop("GOOGLE_SERVICE_ACCOUNT_JSON", None)
    try:
        L.pull(SITE, root=d)
        echoue = False
    except L.EditorialError:
        echoue = True
    finally:
        if sauve is not None:
            os.environ["GOOGLE_SERVICE_ACCOUNT_JSON"] = sauve
    verdict(echoue and empreintes(d) == e0, "5. sans secret, échec sans rien écrire")
    shutil.rmtree(d)

    print("Résultat :", "CONFORME" if not ecarts else f"ÉCART ({len(ecarts)})")
    return 1 if ecarts else 0


if __name__ == "__main__":
    raise SystemExit(main())
