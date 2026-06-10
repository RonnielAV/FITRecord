from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import fitz
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
MUSCLE_PDF = ROOT / "Enciclopedia de ejercicios de musculacion.pdf"
KETO_PDF = ROOT / "Dieta-Keto.-Recetas-faciles-con-5-ingredientes-1.pdf"
OUT_JS = ROOT / "generated-data.js"
MUSCLE_IMG_DIR = ROOT / "assets" / "book-pages" / "musculacion"
KETO_IMG_DIR = ROOT / "assets" / "book-pages" / "keto"


GROUP_RANGES = [
    ("Pectoral", 36, 69),
    ("Dorsal", 72, 103),
    ("Hombros y cuello", 108, 157),
    ("Biceps", 160, 176),
    ("Triceps", 180, 203),
    ("Antebrazos", 208, 216),
    ("Piernas", 222, 271),
    ("Abdomen y lumbar", 274, 305),
]


GROUP_MUSCLES = {
    "Pectoral": {
        "primary": ["pectoral mayor"],
        "secondary": ["triceps", "deltoides anterior", "serrato anterior"],
        "pattern": "empuje horizontal o aduccion del hombro",
    },
    "Dorsal": {
        "primary": ["dorsal ancho", "redondos", "romboides"],
        "secondary": ["biceps", "trapecio", "braquial"],
        "pattern": "traccion vertical u horizontal",
    },
    "Hombros y cuello": {
        "primary": ["deltoides", "trapecio", "manguito rotador"],
        "secondary": ["triceps", "serrato anterior", "musculos cervicales"],
        "pattern": "empuje, elevacion o rotacion del hombro",
    },
    "Biceps": {
        "primary": ["biceps braquial", "braquial anterior"],
        "secondary": ["braquiorradial", "flexores del antebrazo"],
        "pattern": "flexion de codo",
    },
    "Triceps": {
        "primary": ["triceps braquial"],
        "secondary": ["ancorneo", "estabilizadores del hombro"],
        "pattern": "extension de codo",
    },
    "Antebrazos": {
        "primary": ["flexores y extensores del antebrazo"],
        "secondary": ["musculos de prension", "braquiorradial"],
        "pattern": "muneca, agarre y prono-supinacion",
    },
    "Piernas": {
        "primary": ["cuadriceps", "gluteos", "isquiotibiales", "gemelos"],
        "secondary": ["aductores", "abductores", "core", "erectores espinales"],
        "pattern": "sentadilla, bisagra, extension, flexion o elevacion",
    },
    "Abdomen y lumbar": {
        "primary": ["recto abdominal", "oblicuos", "erectores espinales"],
        "secondary": ["transverso abdominal", "cuadrado lumbar", "flexores de cadera"],
        "pattern": "flexion, extension, rotacion o estabilizacion del tronco",
    },
}


def clean_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return value or "item"


def group_for_page(page: int) -> str:
    for group, start, end in GROUP_RANGES:
        if start <= page <= end:
            return group
    return "General"


def group_end(group: str) -> int:
    for name, _start, end in GROUP_RANGES:
        if name == group:
            return end
    return 305


def infer_equipment(name: str) -> list[str]:
    lower = name.lower()
    equipment = []
    rules = [
        ("barra", "barra"),
        ("mancuerna", "mancuernas"),
        ("polea", "polea"),
        ("maquina", "maquina"),
        ("máquina", "maquina"),
        ("multipower", "multipower"),
        ("banco", "banco"),
        ("paralela", "paralelas"),
        ("prensa", "prensa"),
        ("disco", "disco"),
        ("pica", "pica"),
        ("cuerda", "cuerda"),
    ]
    for needle, label in rules:
        if needle in lower and label not in equipment:
            equipment.append(label)
    if not equipment:
        equipment.append("peso corporal o equipo especifico")
    return equipment


def generic_exercise_details(group: str, name: str, page_images: list[str]) -> dict:
    return {
        "purpose": (
            "Ficha importada del libro con paginas visuales completas. Usa la imagen del libro "
            "como referencia principal de postura, recorrido y comentarios tecnicos."
        ),
        "setup": [
            "Abre la imagen de la pagina en tamano completo antes de ejecutar el ejercicio.",
            "Revisa la posicion inicial, agarres, apoyos y alineacion articular mostrados.",
            "Empieza con una carga ligera hasta poder imitar el recorrido sin compensaciones.",
            "Registra peso en lb, repeticiones, series, RPE y notas de tecnica."
        ],
        "execution": [
            "Compara tu posicion inicial con la pagina del libro.",
            "Ejecuta la primera repeticion lenta, confirmando que el movimiento sigue el mismo recorrido visual.",
            "Controla la fase de bajada y evita rebotes.",
            "Pausa si pierdes postura o si una articulacion se mueve fuera de la linea mostrada.",
            "Termina la serie dejando varias repeticiones en reserva si eres principiante."
        ],
        "beginnerCues": [
            "No persigas peso antes de dominar la trayectoria.",
            "Usa espejo o video lateral para comparar con la imagen.",
            "Lee las advertencias de la pagina del libro y las advertencias generales de FitRecord.",
            "Si dudas, reduce rango o carga y pide correccion tecnica."
        ],
        "expertCues": [
            "Usa tempo, pausas y rango completo solo cuando mantengas control.",
            "Ajusta volumen semanal segun recuperacion del grupo muscular.",
            "Compara variantes del libro antes de cambiar agarre, banco o angulo.",
            "Registra notas tecnicas para repetir la mejor ejecucion en futuras sesiones."
        ],
        "mistakes": [
            "Copiar solo la posicion final sin controlar la transicion.",
            "Usar impulso para completar repeticiones.",
            "Cambiar agarre o postura sin entender la variante.",
            "Ignorar dolor articular o perdida de alineacion."
        ],
        "warnings": [
            "Deten el ejercicio ante dolor punzante, adormecimiento, mareo o perdida brusca de fuerza.",
            "Las imagenes provienen de tu PDF local y deben usarse como referencia privada.",
            "Consulta con un profesional si tienes lesiones o condiciones medicas relevantes."
        ],
        "variations": [
            "Revisa las variantes numeradas en la ficha importada.",
            "Cambia una sola variable por vez: agarre, angulo, maquina, carga o rango.",
            "Mantiene la tecnica base antes de probar variantes avanzadas."
        ],
        "bookImageCount": len(page_images),
    }


def render_pdf_pages(pdf_path: Path, output_dir: Path, pdf_pages: set[int], scale: float = 1.62) -> dict[int, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(str(pdf_path))
    rendered: dict[int, str] = {}
    for pdf_page in sorted(pdf_pages):
        if pdf_page < 1 or pdf_page > len(doc):
            continue
        filename = f"page-{pdf_page:03d}.jpg"
        out_path = output_dir / filename
        if not out_path.exists():
            page = doc[pdf_page - 1]
            pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
            pix.save(str(out_path), jpg_quality=84)
        rendered[pdf_page] = out_path.relative_to(ROOT).as_posix()
    return rendered


def extract_exercises() -> tuple[list[dict], set[int]]:
    reader = PdfReader(str(MUSCLE_PDF))
    appendix_text = "\n".join(reader.pages[i - 1].extract_text() or "" for i in range(316, 335))
    appendix_text = clean_spaces(appendix_text)
    pattern = re.compile(r"(?<![\d.])(\d{1,2})\.\s+(.+?)\s+P.gina\s+(\d{2,3})")
    matches = list(pattern.finditer(appendix_text))

    raw = []
    for index, match in enumerate(matches):
        number = int(match.group(1))
        name = clean_spaces(match.group(2)).strip(" .")
        book_page = int(match.group(3))
        group = group_for_page(book_page)
        next_book_page = None
        for next_match in matches[index + 1 :]:
            candidate_page = int(next_match.group(3))
            if group_for_page(candidate_page) == group:
                next_book_page = candidate_page
                break
            break
        end_page = min((next_book_page - 1) if next_book_page else group_end(group), group_end(group))
        page_span = list(range(book_page, end_page + 1))

        block_end = matches[index + 1].start() if index + 1 < len(matches) else len(appendix_text)
        block = appendix_text[match.end() : block_end]
        variants = []
        variant_pattern = re.compile(rf"\b{number}\.(\d+)\s+\.{{3}}\s*(.*?)(?=(?:\s+{number}\.\d+\s+\.{{3}})|$)")
        for variant in variant_pattern.finditer(block):
            variant_name = clean_spaces(variant.group(2))
            variant_name = re.sub(
                r"\s+(Peso libre|M.quinas|Máquinas|Maquinas|Otros|PECTORAL|DORSAL|HOMBROS|CUELLO|B.CEPS|TR.CEPS|ANTEBRAZOS|PIERNAS|ABDOMEN Y LUMBAR)\b.*$",
                "",
                variant_name,
                flags=re.IGNORECASE,
            ).strip(" .")
            if variant_name:
                variants.append({"number": f"{number}.{variant.group(1)}", "name": variant_name})

        pdf_pages = [page + 1 for page in page_span]
        raw.append(
            {
                "id": f"ex-{book_page}-{slugify(name)}",
                "name": name,
                "englishName": "",
                "group": group,
                "bookPage": book_page,
                "bookPages": page_span,
                "pdfPages": pdf_pages,
                "equipment": infer_equipment(name),
                "level": "novato a experto",
                "pattern": GROUP_MUSCLES.get(group, {}).get("pattern", "ejercicio de musculacion"),
                "primaryMuscles": GROUP_MUSCLES.get(group, {}).get("primary", []),
                "secondaryMuscles": GROUP_MUSCLES.get(group, {}).get("secondary", []),
                "antagonists": [],
                "variants": variants,
                "prescription": {
                    "sets": "2-5",
                    "reps": "6-15",
                    "rest": "60-180 s",
                    "intensity": "RPE 6-9 segun nivel",
                },
            }
        )

    pdf_pages_to_render = {page for item in raw for page in item["pdfPages"]}
    return raw, pdf_pages_to_render


def extract_recipe_outline() -> list[dict]:
    reader = PdfReader(str(KETO_PDF))
    recipe_entries = []
    current_chapter = None
    chapter_prefixes = ("Dos.", "Tres.", "Cuatro.", "Cinco.", "Seis.", "Siete.", "Ocho.")
    for item in reader.outline:
        if isinstance(item, list):
            for child in item:
                title = getattr(child, "title", str(child)).strip()
                try:
                    page = reader.get_destination_page_number(child) + 1
                except Exception:
                    continue
                if current_chapter and current_chapter.startswith(chapter_prefixes):
                    recipe_entries.append({"chapter": current_chapter, "bookPage": page, "name": title})
        else:
            current_chapter = getattr(item, "title", str(item)).strip()
    return recipe_entries


def meal_type_for_chapter(chapter: str) -> str:
    if chapter.startswith("Dos."):
        return "desayuno"
    if chapter.startswith("Tres."):
        return "comida"
    if chapter.startswith("Cuatro."):
        return "snack"
    if chapter.startswith("Cinco.") or chapter.startswith("Seis."):
        return "cena"
    if chapter.startswith("Siete."):
        return "postre"
    if chapter.startswith("Ocho."):
        return "salsa"
    return "comida"


def parse_macros(text: str) -> dict | None:
    macro_re = re.compile(
        r"POR PORCI.N\s+Calor.as:\s*([\d.,]+);\s*grasas totales:\s*([\d.,]+)\s*g;\s*"
        r"carbohidratos:\s*([\d.,]+)\s*g;\s*carbohidratos netos:\s*([\d.,]+)\s*g;\s*"
        r"fibra:\s*([\d.,]+)\s*g;\s*prote.na:\s*([\d.,]+)\s*g",
        re.IGNORECASE,
    )
    match = macro_re.search(text)
    if not match:
        return None
    calories, fat, carbs, net_carbs, fiber, protein = [float(value.replace(",", ".")) for value in match.groups()]
    return {
        "calories": round(calories),
        "fat": fat,
        "carbs": carbs,
        "netCarbs": net_carbs,
        "fiber": fiber,
        "protein": protein,
    }


def parse_recipe_tags(text: str) -> list[str]:
    tags = []
    checks = [
        ("30 MINUTOS", "30 minutos"),
        ("UNA SART", "una sarten"),
        ("UNA OLLA", "una olla"),
        ("SIN COCCI", "sin coccion"),
        ("VEGETARIANA", "vegetariana"),
    ]
    upper = text.upper()
    for needle, label in checks:
        if needle in upper:
            tags.append(label)
    return tags


def parse_time_minutes(text: str) -> int | None:
    match = re.search(r"(\d+)\s+MINUTOS", text, re.IGNORECASE)
    return int(match.group(1)) if match else None


def parse_servings(text: str) -> str:
    match = re.search(r"Rinde:\s*(.+?)\s+Preparaci", text, re.IGNORECASE)
    return clean_spaces(match.group(1)) if match else ""


def extract_recipes() -> tuple[list[dict], set[int]]:
    reader = PdfReader(str(KETO_PDF))
    entries = extract_recipe_outline()
    recipes = []
    pdf_pages_to_render: set[int] = set()

    for index, entry in enumerate(entries):
        start = entry["bookPage"]
        next_start = entries[index + 1]["bookPage"] if index + 1 < len(entries) else 319
        page_span = list(range(start, max(start, next_start - 1) + 1))
        text = clean_spaces(" ".join(reader.pages[page - 1].extract_text() or "" for page in page_span if page <= len(reader.pages)))
        macros = parse_macros(text) or {
            "calories": 0,
            "fat": 0,
            "carbs": 0,
            "netCarbs": 0,
            "fiber": 0,
            "protein": 0,
        }
        tags = parse_recipe_tags(text)
        chapter = entry["chapter"]
        pdf_pages = page_span[:]
        pdf_pages_to_render.update(pdf_pages)
        recipes.append(
            {
                "id": f"rx-{start}-{slugify(entry['name'])}",
                "name": entry["name"],
                "chapter": chapter,
                "bookPage": start,
                "bookPages": page_span,
                "pdfPages": pdf_pages,
                "mealType": meal_type_for_chapter(chapter),
                "tags": tags,
                "timeMinutes": parse_time_minutes(text),
                "servingsLabel": parse_servings(text),
                "servings": 1,
                "macros": macros,
                "ingredients": [],
                "preparation": {
                    "setup": [
                        "Abre la pagina del libro en tamano completo para ver ingredientes, pasos y consejos exactos.",
                        "Mide porciones antes de registrar la comida.",
                    ],
                    "steps": [
                        "Sigue la preparacion visual y textual de la pagina del libro.",
                        "Registra porciones consumidas para calcular macros.",
                    ],
                    "beginnerTips": [
                        "Lee la receta completa antes de calentar sarten u horno.",
                        "Confirma carbohidratos netos y porciones antes de repetir o duplicar ingredientes.",
                    ],
                    "substitutions": ["Usa las sustituciones indicadas en la pagina cuando esten disponibles."],
                    "storage": "Consulta la pagina del libro si incluye conservacion; si no, refrigera sobras de forma segura.",
                    "warnings": "Controla calorias, sodio, lacteos y posibles alergias segun tu perfil.",
                },
            }
        )

    return recipes, pdf_pages_to_render


def attach_images(exercises: list[dict], recipes: list[dict], exercise_images: dict[int, str], recipe_images: dict[int, str]) -> None:
    for item in exercises:
        item["pageImages"] = [exercise_images[pdf_page] for pdf_page in item["pdfPages"] if pdf_page in exercise_images]
        item["image"] = item["pageImages"][0] if item["pageImages"] else ""
        item["details"] = generic_exercise_details(item["group"], item["name"], item["pageImages"])

    for item in recipes:
        item["pageImages"] = [recipe_images[pdf_page] for pdf_page in item["pdfPages"] if pdf_page in recipe_images]
        item["image"] = item["pageImages"][0] if item["pageImages"] else ""


def main() -> None:
    exercises, exercise_pages = extract_exercises()
    recipes, recipe_pages = extract_recipes()
    exercise_images = render_pdf_pages(MUSCLE_PDF, MUSCLE_IMG_DIR, exercise_pages)
    recipe_images = render_pdf_pages(KETO_PDF, KETO_IMG_DIR, recipe_pages)
    attach_images(exercises, recipes, exercise_images, recipe_images)

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceMode": "local-private-book-pages",
        "counts": {
            "exercises": len(exercises),
            "recipes": len(recipes),
            "exercisePageImages": len(exercise_images),
            "recipePageImages": len(recipe_images),
        },
        "exercises": exercises,
        "recipes": recipes,
    }

    OUT_JS.write_text(
        "window.FITRECORD_GENERATED_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(json.dumps(payload["counts"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
