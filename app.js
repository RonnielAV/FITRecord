const STORE = {
  profiles: "fitrecord.profiles.v1",
  activeProfile: "fitrecord.activeProfile.v1",
  logs: "fitrecord.logs.v1",
  workoutSelections: "fitrecord.workoutSelections.v1",
  expandedCards: "fitrecord.expandedCards.v1",
  ketoPanel: "fitrecord.ketoPanel.v1"
};

const data = {
  ...(window.FITRECORD_GENERATED_DATA || window.FITRECORD_DATA),
  warnings: window.FITRECORD_DATA?.warnings ?? { exercise: [], keto: [] }
};
const usingGeneratedBooks = Boolean(window.FITRECORD_GENERATED_DATA);
let state = {
  profiles: readJson(STORE.profiles, []),
  activeProfileId: localStorage.getItem(STORE.activeProfile),
  logs: readJson(STORE.logs, []),
  workoutSelections: readJson(STORE.workoutSelections, {}),
  expandedCards: readJson(STORE.expandedCards, {}),
  ketoPanel: readJson(STORE.ketoPanel, {}),
  view: "today"
};

const GROUP_COMBOS = {
  "Pectoral": ["Hombros y cuello", "Triceps", "Abdomen y lumbar"],
  "Dorsal": ["Biceps", "Antebrazos", "Abdomen y lumbar"],
  "Hombros y cuello": ["Pectoral", "Triceps", "Abdomen y lumbar"],
  "Biceps": ["Dorsal", "Antebrazos"],
  "Triceps": ["Pectoral", "Hombros y cuello"],
  "Antebrazos": ["Dorsal", "Biceps"],
  "Piernas": ["Abdomen y lumbar", "Dorsal"],
  "Abdomen y lumbar": ["Piernas", "Pectoral", "Dorsal"]
};

const WORKOUT_TEMPLATES = [
  { label: "Push", groups: ["Pectoral", "Hombros y cuello", "Triceps"] },
  { label: "Pull", groups: ["Dorsal", "Biceps", "Antebrazos"] },
  { label: "Piernas", groups: ["Piernas", "Abdomen y lumbar"] },
  { label: "Torso", groups: ["Pectoral", "Dorsal", "Hombros y cuello"] },
  { label: "Full body", groups: ["Piernas", "Pectoral", "Dorsal", "Abdomen y lumbar"] }
];

const app = document.querySelector("#app");
const profileSelect = document.querySelector("#profileSelect");
const toast = document.querySelector("#toast");

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    state.view = button.dataset.view;
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("is-active"));
    button.classList.add("is-active");
    render();
  });
});

document.querySelector("#newProfileBtn").addEventListener("click", () => {
  state.view = "profile";
  setActiveTab("profile");
  renderProfile(true);
});

profileSelect.addEventListener("change", (event) => {
  state.activeProfileId = event.target.value;
  localStorage.setItem(STORE.activeProfile, state.activeProfileId);
  render();
});

ensureSeedProfile();
render();

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function todayKey(date = new Date()) {
  const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 10);
}

function activeProfile() {
  return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;
}

function ensureSeedProfile() {
  if (state.profiles.length > 0) {
    if (!activeProfile()) {
      state.activeProfileId = state.profiles[0].id;
      localStorage.setItem(STORE.activeProfile, state.activeProfileId);
    }
    syncProfileSelect();
    return;
  }

  const id = crypto.randomUUID();
  state.profiles = [
    {
      id,
      name: "Usuario FitRecord",
      age: 30,
      heightIn: 68,
      sex: "no especificado",
      goal: "ganar masa y bajar grasa",
      level: "novato",
      equipment: ["barra", "mancuernas", "banco", "rack", "poleas"],
      startingWeightLb: 180,
      currentWeightLb: 180,
      goalWeightLb: 170,
      bodyFatPct: 24,
      muscleMassLb: 118,
      neckIn: 15,
      waistIn: 36,
      chestIn: 40,
      hipsIn: 39,
      armIn: 13,
      thighIn: 22,
      netCarbTarget: 25,
      calorieTarget: 2100,
      proteinTarget: 150,
      conditions: "",
      injuries: ""
    }
  ];
  state.activeProfileId = id;
  writeJson(STORE.profiles, state.profiles);
  localStorage.setItem(STORE.activeProfile, id);
  syncProfileSelect();
}

function syncProfileSelect() {
  profileSelect.innerHTML = state.profiles
    .map((profile) => `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`)
    .join("");
  profileSelect.value = state.activeProfileId;
}

function setActiveTab(view) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === view);
  });
}

function render() {
  syncProfileSelect();
  const profile = activeProfile();
  if (!profile && state.view !== "profile") {
    renderProfile(true);
    return;
  }

  const views = {
    today: renderToday,
    library: renderLibrary,
    nutrition: renderNutrition,
    week: renderWeek,
    profile: () => renderProfile(false),
    warnings: renderWarnings
  };
  views[state.view]();
  app.focus({ preventScroll: true });
}

function renderToday() {
  const profile = activeProfile();
  const date = todayKey();
  const dayLogs = logsForDate(date);
  const selectedGroups = getWorkoutGroupsForDate(profile.id, date);
  const plan = generateTrainingPlan(profile, selectedGroups);
  const mealPlan = generateMealPlan(profile);
  const macros = totalMacros(dayLogs.meals);
  const ketoCollapsed = isKetoPanelCollapsed(profile.id);

  app.innerHTML = `
    <section class="hero-band">
      <div>
        <h2>Hoy, ${escapeHtml(profile.name)}</h2>
        <p>Registra peso, medidas, entrenamiento y comidas. Las rutinas usan lbs para cargas y las medidas corporales se guardan en pulgadas.</p>
        ${sourceSummary()}
        <div class="actions">
          <button class="primary" type="button" data-action="quick-checkin">Guardar chequeo de hoy</button>
          <button class="secondary" type="button" data-view-jump="week">Ver semana</button>
          <button class="secondary" type="button" data-action="download-workout-pdf">Descargar entrenamiento PDF</button>
        </div>
      </div>
      <div class="metrics">
        ${metric("Peso", `${profile.currentWeightLb} lb`, `meta ${profile.goalWeightLb} lb`)}
        ${metric("Altura", heightFeet(profile.heightIn), `${profile.heightIn} in`)}
        ${metric("Carbos netos", `${macros.netCarbs} g`, `meta ${profile.netCarbTarget} g`)}
        ${metric("Volumen hoy", `${volumeForLogs(dayLogs.exercises).toLocaleString()} lb`, "series x reps x peso")}
      </div>
    </section>

    <div class="grid two today-layout ${ketoCollapsed ? "keto-collapsed" : ""}" style="margin-top:16px">
      <section class="panel">
        ${workoutSelectionPanel(profile, selectedGroups, plan)}
        <div class="view-header">
          <div>
            <h2>Entrenamiento del dia</h2>
            <p>${escapeHtml(plan.focus)}. Cada ejercicio muestra paginas reales renderizadas del libro para imitar postura, recorrido y detalles tecnicos paso a paso.</p>
          </div>
        </div>
        <div class="grid">
          ${plan.exercises.map((exercise) => exerciseCard(exercise, true)).join("")}
        </div>
      </section>

      <aside class="panel keto-panel ${ketoCollapsed ? "is-collapsed" : ""}">
        <div class="keto-panel-header">
          <div class="keto-panel-title">
            <h2>Plan keto del dia</h2>
            <p class="muted">Meta diaria: ${profile.calorieTarget} kcal, ${profile.proteinTarget} g proteina, ${profile.netCarbTarget} g carbos netos.</p>
          </div>
          <button class="keto-panel-toggle" type="button" data-toggle-keto-panel="true" aria-expanded="${ketoCollapsed ? "false" : "true"}" aria-label="${ketoCollapsed ? "Mostrar plan keto" : "Ocultar plan keto"}">
            <span>${ketoCollapsed ? "<" : ">"}</span>
          </button>
        </div>
        <div class="keto-panel-collapsed-label" ${ketoCollapsed ? "" : "hidden"}>
          <strong>Keto</strong>
          <span>Mostrar</span>
        </div>
        <div class="keto-panel-body" ${ketoCollapsed ? "hidden" : ""}>
          <div class="grid">
            ${mealPlan.map((recipe) => recipeCard(recipe, true)).join("")}
          </div>
        </div>
      </aside>
    </div>
  `;

  bindCommonActions();
}

function workoutSelectionPanel(profile, selectedGroups, plan) {
  const allGroups = [...new Set(data.exercises.map((exercise) => exercise.group))];
  const suggestions = getSuggestedGroups(selectedGroups);
  const selectedLabel = selectedGroups.length > 0 ? selectedGroups.join(" + ") : "Sin seleccionar";
  return `
    <section class="selector-band">
      <div class="selector-header">
        <div>
          <h2>Armar rutina de hoy</h2>
          <p>Marca un grupo muscular y FitRecord te propone una combinacion compatible. Puedes mezclar varios checks o aplicar una plantilla rapida.</p>
        </div>
        <div class="selector-summary">
          <span>Seleccion</span>
          <strong>${escapeHtml(selectedLabel)}</strong>
        </div>
      </div>

      <div class="builder-block">
        <div class="builder-label">Grupos musculares</div>
        <div class="group-chip-grid">
          ${allGroups.map((group) => groupToggle(group, selectedGroups.includes(group))).join("")}
        </div>
      </div>

      <div class="builder-block">
        <div class="builder-label">Sugerencias de combinacion</div>
        <div class="tag-row builder-tags">
          ${suggestions.map((group) => suggestionButton(group)).join("")}
        </div>
      </div>

      <div class="builder-block">
        <div class="builder-label">Plantillas rapidas</div>
        <div class="template-row">
          ${WORKOUT_TEMPLATES.map((template) => templateButton(template)).join("")}
        </div>
      </div>

      <div class="builder-footer">
        <p class="muted">Vista previa: ${plan.exercises.length} ejercicio${plan.exercises.length === 1 ? "" : "s"} recomendados segun tu seleccion y objetivo ${escapeHtml(profile.goal)}.</p>
        <div class="actions">
          <button class="secondary" type="button" data-clear-groups="true">Limpiar seleccion</button>
        </div>
      </div>
    </section>
  `;
}

function renderLibrary() {
  const groups = [...new Set(data.exercises.map((exercise) => exercise.group))];
  app.innerHTML = `
    <section class="view-header">
      <div>
        <h2>Biblioteca de ejercicios</h2>
        <p>${data.exercises.length} ejercicios importados. Cada ficha conserva pagina fuente, variantes detectadas y paginas reales del libro como imagenes locales privadas.</p>
      </div>
      <select id="groupFilter" aria-label="Filtrar grupo muscular">
        <option value="todos">Todos los grupos</option>
        ${groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join("")}
      </select>
    </section>
    <section id="exerciseList" class="grid"></section>
  `;

  const renderList = () => {
    const selected = document.querySelector("#groupFilter").value;
    const exercises = selected === "todos"
      ? data.exercises
      : data.exercises.filter((exercise) => exercise.group === selected);
    document.querySelector("#exerciseList").innerHTML = exercises
      .map((exercise) => exerciseCard(exercise, true))
      .join("");
    bindCommonActions();
  };

  document.querySelector("#groupFilter").addEventListener("change", renderList);
  renderList();
}

function renderNutrition() {
  const chapters = [...new Set(data.recipes.map((recipe) => recipe.chapter))];
  app.innerHTML = `
    <section class="view-header">
      <div>
        <h2>Biblioteca keto</h2>
        <p>${data.recipes.length} recetas importadas con macros detectados cuando el PDF los expone. Las paginas completas del libro quedan visibles como imagenes locales.</p>
      </div>
      <select id="recipeFilter" aria-label="Filtrar recetas">
        <option value="todas">Todas las recetas</option>
        ${chapters.map((chapter) => `<option value="${escapeHtml(chapter)}">${escapeHtml(chapter)}</option>`).join("")}
      </select>
    </section>
    <section id="recipeList" class="grid two"></section>
  `;

  const renderList = () => {
    const selected = document.querySelector("#recipeFilter").value;
    const recipes = selected === "todas"
      ? data.recipes
      : data.recipes.filter((recipe) => recipe.chapter === selected);
    document.querySelector("#recipeList").innerHTML = recipes.map((recipe) => recipeCard(recipe, true)).join("");
    bindCommonActions();
  };

  document.querySelector("#recipeFilter").addEventListener("change", renderList);
  renderList();
}

function renderWeek() {
  const profile = activeProfile();
  const days = lastSevenDays();
  const rows = days.map((date) => {
    const dayLogs = logsForDate(date);
    const checkin = dayLogs.checkin;
    const macros = totalMacros(dayLogs.meals);
    return { date, dayLogs, checkin, macros };
  });
  const firstWeight = rows.find((row) => row.checkin?.weightLb)?.checkin?.weightLb ?? profile.currentWeightLb;
  const lastWeight = [...rows].reverse().find((row) => row.checkin?.weightLb)?.checkin?.weightLb ?? profile.currentWeightLb;
  const firstMuscle = rows.find((row) => row.checkin?.muscleMassLb)?.checkin?.muscleMassLb ?? profile.muscleMassLb;
  const lastMuscle = [...rows].reverse().find((row) => row.checkin?.muscleMassLb)?.checkin?.muscleMassLb ?? profile.muscleMassLb;
  const totalVolume = rows.reduce((sum, row) => sum + volumeForLogs(row.dayLogs.exercises), 0);

  app.innerHTML = `
    <section class="view-header">
      <div>
        <h2>Avance semanal</h2>
        <p>Compara peso, masa muscular estimada, volumen levantado, ejercicios realizados y comidas registradas durante los ultimos 7 dias.</p>
      </div>
    </section>

    <section class="metrics">
      ${metric("Cambio de peso", signed(lastWeight - firstWeight, "lb"), `${firstWeight} -> ${lastWeight} lb`)}
      ${metric("Masa muscular", signed(lastMuscle - firstMuscle, "lb"), `${firstMuscle} -> ${lastMuscle} lb`)}
      ${metric("Volumen semanal", `${totalVolume.toLocaleString()} lb`, "series x reps x peso")}
      ${metric("Comidas registradas", rows.reduce((sum, row) => sum + row.dayLogs.meals.length, 0), "ultimos 7 dias")}
    </section>

    <section class="panel" style="margin-top:16px">
      <table class="progress-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cuerpo</th>
            <th>Entrenamiento</th>
            <th>Keto</th>
            <th>Volumen</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => weeklyRow(row, profile.netCarbTarget)).join("")}
        </tbody>
      </table>
    </section>
  `;
}

function renderProfile(forceNew) {
  const profile = forceNew ? null : activeProfile();
  const title = profile ? "Editar perfil" : "Crear perfil";

  app.innerHTML = `
    <section class="view-header">
      <div>
        <h2>${title}</h2>
        <p>FitRecord usa lbs, pulgadas, carbohidratos netos y registros semanales por perfil.</p>
      </div>
    </section>

    <form id="profileForm" class="panel">
      <div class="form-grid">
        ${field("name", "Nombre", profile?.name ?? "", "text", "wide")}
        ${field("age", "Edad", profile?.age ?? 30, "number")}
        ${selectField("sex", "Sexo", profile?.sex ?? "no especificado", ["no especificado", "femenino", "masculino"])}
        ${field("heightIn", "Altura (in)", profile?.heightIn ?? 68, "number")}
        ${field("startingWeightLb", "Peso inicial (lb)", profile?.startingWeightLb ?? 180, "number")}
        ${field("currentWeightLb", "Peso actual (lb)", profile?.currentWeightLb ?? 180, "number")}
        ${field("goalWeightLb", "Peso meta (lb)", profile?.goalWeightLb ?? 170, "number")}
        ${selectField("level", "Nivel", profile?.level ?? "novato", ["novato", "intermedio", "avanzado"])}
        ${selectField("goal", "Objetivo", profile?.goal ?? "ganar masa y bajar grasa", ["bajar grasa", "ganar masa", "fuerza", "ganar masa y bajar grasa", "mantenimiento"])}
        ${field("bodyFatPct", "Grasa corporal (%)", profile?.bodyFatPct ?? 24, "number")}
        ${field("muscleMassLb", "Masa muscular (lb)", profile?.muscleMassLb ?? 118, "number")}
        ${field("neckIn", "Cuello (in)", profile?.neckIn ?? 15, "number")}
        ${field("waistIn", "Cintura (in)", profile?.waistIn ?? 36, "number")}
        ${field("chestIn", "Pecho (in)", profile?.chestIn ?? 40, "number")}
        ${field("hipsIn", "Cadera (in)", profile?.hipsIn ?? 39, "number")}
        ${field("armIn", "Brazo (in)", profile?.armIn ?? 13, "number")}
        ${field("thighIn", "Muslo (in)", profile?.thighIn ?? 22, "number")}
        ${field("calorieTarget", "Calorias meta", profile?.calorieTarget ?? 2100, "number")}
        ${field("proteinTarget", "Proteina meta (g)", profile?.proteinTarget ?? 150, "number")}
        ${field("netCarbTarget", "Carbos netos meta (g)", profile?.netCarbTarget ?? 25, "number")}
        ${textArea("equipment", "Equipo disponible", (profile?.equipment ?? ["barra", "mancuernas", "banco"]).join(", "), "full")}
        ${textArea("injuries", "Lesiones o molestias", profile?.injuries ?? "", "wide")}
        ${textArea("conditions", "Condiciones medicas o medicamentos relevantes", profile?.conditions ?? "", "wide")}
      </div>
      <section class="calculation-panel">
        <div class="view-header">
          <div>
            <h2>Calculos automaticos</h2>
            <p>Estimaciones basadas en tus datos base. Se actualizan en vivo mientras editas el perfil.</p>
          </div>
        </div>
        <div id="calcMetrics"></div>
      </section>
      <div class="actions">
        <button class="primary" type="submit">Guardar perfil</button>
        <button class="secondary" type="button" data-action="download-profile-json">Descargar perfil JSON</button>
        ${profile ? '<button class="danger" type="button" data-action="delete-profile">Eliminar perfil</button>' : ""}
      </div>
    </form>
  `;

  document.querySelector("#profileForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = profilePayloadFromForm(event.currentTarget, profile);

    const existingIndex = state.profiles.findIndex((item) => item.id === payload.id);
    if (existingIndex >= 0) {
      state.profiles[existingIndex] = payload;
    } else {
      state.profiles.push(payload);
    }
    state.activeProfileId = payload.id;
    writeJson(STORE.profiles, state.profiles);
    localStorage.setItem(STORE.activeProfile, payload.id);
    syncProfileSelect();
    showToast("Perfil guardado");
    state.view = "today";
    setActiveTab("today");
    render();
  });

  const deleteButton = document.querySelector('[data-action="delete-profile"]');
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      if (!confirm("Eliminar este perfil y sus registros?")) return;
      state.logs = state.logs.filter((log) => log.profileId !== profile.id);
      state.profiles = state.profiles.filter((item) => item.id !== profile.id);
      state.activeProfileId = state.profiles[0]?.id ?? null;
      writeJson(STORE.logs, state.logs);
      writeJson(STORE.profiles, state.profiles);
      if (state.activeProfileId) localStorage.setItem(STORE.activeProfile, state.activeProfileId);
      ensureSeedProfile();
      state.view = "today";
      setActiveTab("today");
      render();
    });
  }

  document.querySelector('[data-action="download-profile-json"]')?.addEventListener("click", () => {
    const form = document.querySelector("#profileForm");
    if (!(form instanceof HTMLFormElement)) return;
    const payload = profilePayloadFromForm(form, profile);
    downloadProfileJson(payload);
  });

  bindProfileCalculations();
}

function profilePayloadFromForm(formElement, existingProfile = null) {
  const form = new FormData(formElement);
  return {
    id: existingProfile?.id ?? crypto.randomUUID(),
    name: form.get("name").trim() || "Nuevo perfil",
    age: numberValue(form.get("age")),
    heightIn: numberValue(form.get("heightIn")),
    sex: form.get("sex"),
    goal: form.get("goal"),
    level: form.get("level"),
    equipment: form.get("equipment").split(",").map((item) => item.trim()).filter(Boolean),
    startingWeightLb: numberValue(form.get("startingWeightLb")),
    currentWeightLb: numberValue(form.get("currentWeightLb")),
    goalWeightLb: numberValue(form.get("goalWeightLb")),
    bodyFatPct: numberValue(form.get("bodyFatPct")),
    muscleMassLb: numberValue(form.get("muscleMassLb")),
    neckIn: numberValue(form.get("neckIn")),
    waistIn: numberValue(form.get("waistIn")),
    chestIn: numberValue(form.get("chestIn")),
    hipsIn: numberValue(form.get("hipsIn")),
    armIn: numberValue(form.get("armIn")),
    thighIn: numberValue(form.get("thighIn")),
    calorieTarget: numberValue(form.get("calorieTarget")),
    proteinTarget: numberValue(form.get("proteinTarget")),
    netCarbTarget: numberValue(form.get("netCarbTarget")),
    injuries: form.get("injuries").trim(),
    conditions: form.get("conditions").trim()
  };
}

function bindProfileCalculations() {
  const form = document.querySelector("#profileForm");
  const metricsNode = document.querySelector("#calcMetrics");
  if (!form || !metricsNode) return;

  const applyNumericValue = (fieldName, value, digits = 1) => {
    const input = form.elements.namedItem(fieldName);
    if (!(input instanceof HTMLInputElement) || !Number.isFinite(value)) return;
    input.value = String(roundTo(value, digits));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const refresh = () => {
    const values = collectProfileFormValues(form);
    const metrics = calculateDerivedMetrics(values);
    metricsNode.innerHTML = renderCalculationMetrics(metrics, values);
  };

  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);

  metricsNode.addEventListener("click", (event) => {
    const button = event.target.closest("[data-apply-calc]");
    if (!(button instanceof HTMLElement)) return;

    const values = collectProfileFormValues(form);
    const metrics = calculateDerivedMetrics(values);

    if (button.dataset.applyCalc === "navy-body-fat" && Number.isFinite(metrics.navyBodyFatPct)) {
      applyNumericValue("bodyFatPct", metrics.navyBodyFatPct);
      showToast("Se aplico el % de grasa estimado por Navy");
      return;
    }

    if (button.dataset.applyCalc === "targets") {
      if (Number.isFinite(metrics.suggestedCalories)) applyNumericValue("calorieTarget", metrics.suggestedCalories, 0);
      if (Number.isFinite(metrics.suggestedProteinG)) applyNumericValue("proteinTarget", metrics.suggestedProteinG, 0);
      if (Number.isFinite(metrics.suggestedNetCarbsG)) applyNumericValue("netCarbTarget", metrics.suggestedNetCarbsG, 0);
      showToast("Se aplicaron metas sugeridas");
    }
  });

  refresh();
}

function collectProfileFormValues(form) {
  const data = new FormData(form);
  return {
    name: String(data.get("name") ?? ""),
    age: numberValue(data.get("age")),
    sex: String(data.get("sex") ?? "no especificado"),
    heightIn: numberValue(data.get("heightIn")),
    startingWeightLb: numberValue(data.get("startingWeightLb")),
    currentWeightLb: numberValue(data.get("currentWeightLb")),
    goalWeightLb: numberValue(data.get("goalWeightLb")),
    level: String(data.get("level") ?? "novato"),
    goal: String(data.get("goal") ?? "mantenimiento"),
    bodyFatPct: numberValue(data.get("bodyFatPct")),
    muscleMassLb: numberValue(data.get("muscleMassLb")),
    neckIn: numberValue(data.get("neckIn")),
    waistIn: numberValue(data.get("waistIn")),
    chestIn: numberValue(data.get("chestIn")),
    hipsIn: numberValue(data.get("hipsIn")),
    armIn: numberValue(data.get("armIn")),
    thighIn: numberValue(data.get("thighIn")),
    calorieTarget: numberValue(data.get("calorieTarget")),
    proteinTarget: numberValue(data.get("proteinTarget")),
    netCarbTarget: numberValue(data.get("netCarbTarget"))
  };
}

function calculateDerivedMetrics(values) {
  const weightLb = values.currentWeightLb > 0 ? values.currentWeightLb : values.startingWeightLb;
  const heightIn = values.heightIn;
  const age = values.age;
  const weightKg = toKg(weightLb);
  const heightCm = toCm(heightIn);
  const heightM = toMeters(heightIn);
  const bmi = heightIn > 0 && weightLb > 0 ? (703 * weightLb) / (heightIn * heightIn) : null;
  const sexCode = deurenbergSexCode(values.sex);
  const bmiBodyFatPct =
    Number.isFinite(bmi) && age > 0 && sexCode !== null
      ? clamp(1.2 * bmi + 0.23 * age - 10.8 * sexCode - 5.4, 3, 70)
      : null;
  const navyBodyFatPct = calculateNavyBodyFat(values);
  const recordedBodyFatPct = values.bodyFatPct > 0 ? values.bodyFatPct : null;
  const referenceBodyFatPct = firstFinite(navyBodyFatPct, recordedBodyFatPct, bmiBodyFatPct);
  const fatMassLb = Number.isFinite(referenceBodyFatPct) ? (weightLb * referenceBodyFatPct) / 100 : null;
  const leanMassLb = Number.isFinite(fatMassLb) ? weightLb - fatMassLb : null;
  const ffmi =
    Number.isFinite(leanMassLb) && heightM > 0
      ? toKg(leanMassLb) / (heightM * heightM)
      : null;
  const bmr = calculateBmr({ sex: values.sex, age, weightKg, heightCm, leanMassLb });
  const activityFactor = activityFactorForLevel(values.level);
  const tdee = Number.isFinite(bmr) ? bmr * activityFactor : null;
  const suggestedCalories = Number.isFinite(tdee) ? Math.max(1200, tdee + goalCalorieAdjustment(values.goal)) : null;
  const suggestedProteinG = weightLb > 0 ? proteinSuggestion(values.goal, weightLb, leanMassLb) : null;
  const suggestedNetCarbsG = netCarbSuggestion(values.goal);
  const healthyWeightMinLb = heightIn > 0 ? (18.5 * heightIn * heightIn) / 703 : null;
  const healthyWeightMaxLb = heightIn > 0 ? (24.9 * heightIn * heightIn) / 703 : null;
  const goalDeltaLb = values.goalWeightLb > 0 && weightLb > 0 ? values.goalWeightLb - weightLb : null;

  return {
    weightLb,
    bmi,
    bmiCategory: bmiCategory(bmi),
    bmiBodyFatPct,
    navyBodyFatPct,
    recordedBodyFatPct,
    referenceBodyFatPct,
    referenceBodyFatSource: bodyFatSourceLabel(navyBodyFatPct, recordedBodyFatPct, bmiBodyFatPct),
    fatMassLb,
    leanMassLb,
    ffmi,
    bmr,
    bmrMethod: bmrMethodLabel(values.sex, leanMassLb),
    activityFactor,
    tdee,
    suggestedCalories,
    suggestedProteinG,
    suggestedNetCarbsG,
    healthyWeightMinLb,
    healthyWeightMaxLb,
    goalDeltaLb
  };
}

function calculateNavyBodyFat(values) {
  if (values.heightIn <= 0 || values.neckIn <= 0 || values.waistIn <= 0) return null;

  if (values.sex === "masculino") {
    const abdomenMinusNeck = values.waistIn - values.neckIn;
    if (abdomenMinusNeck <= 0) return null;
    return clamp(86.01 * Math.log10(abdomenMinusNeck) - 70.041 * Math.log10(values.heightIn) + 36.76, 3, 70);
  }

  if (values.sex === "femenino") {
    const waistHipNeck = values.waistIn + values.hipsIn - values.neckIn;
    if (values.hipsIn <= 0 || waistHipNeck <= 0) return null;
    return clamp(163.205 * Math.log10(waistHipNeck) - 97.684 * Math.log10(values.heightIn) - 78.387, 3, 70);
  }

  return null;
}

function calculateBmr({ sex, age, weightKg, heightCm, leanMassLb }) {
  if (age <= 0) return null;

  if ((sex === "masculino" || sex === "femenino") && weightKg > 0 && heightCm > 0) {
    return sex === "masculino"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }

  if (Number.isFinite(leanMassLb) && leanMassLb > 0) {
    return 370 + 21.6 * toKg(leanMassLb);
  }

  return null;
}

function renderCalculationMetrics(metrics, values) {
  const compositionSubtext = Number.isFinite(metrics.leanMassLb)
    ? `${formatCalc(metrics.leanMassLb, 1)} lb masa libre · FFMI ${formatCalc(metrics.ffmi, 1)}`
    : "Agrega % de grasa o medidas de Navy para estimar composicion";
  const calorieSubtext = Number.isFinite(metrics.tdee)
    ? `BMR ${formatCalc(metrics.bmr, 0)} kcal · factor ${formatCalc(metrics.activityFactor, 2)}`
    : "Completa edad, altura y peso. Si no defines sexo, se usa masa magra si esta disponible";
  const goalSummary = Number.isFinite(metrics.goalDeltaLb)
    ? metrics.goalDeltaLb < 0
      ? `${formatCalc(Math.abs(metrics.goalDeltaLb), 1)} lb por bajar`
      : metrics.goalDeltaLb > 0
        ? `${formatCalc(metrics.goalDeltaLb, 1)} lb por subir`
        : "Meta alcanzada"
    : "Agrega peso meta";

  return `
    <div class="metrics calc-metrics">
      ${calcMetricCard(
        "IMC",
        Number.isFinite(metrics.bmi) ? formatCalc(metrics.bmi, 1) : "Completa altura y peso",
        Number.isFinite(metrics.bmi) ? `${metrics.bmiCategory}. ${heightFeet(values.heightIn)} y ${formatCalc(metrics.weightLb, 1)} lb` : "Referencia general: no distingue cuanta masa es musculo"
      )}
      ${calcMetricCard(
        "Rango saludable",
        Number.isFinite(metrics.healthyWeightMinLb) ? `${formatCalc(metrics.healthyWeightMinLb, 0)} - ${formatCalc(metrics.healthyWeightMaxLb, 0)} lb` : "Falta altura",
        "Basado en IMC 18.5 a 24.9"
      )}
      ${calcMetricCard(
        "% grasa por IMC",
        Number.isFinite(metrics.bmiBodyFatPct) ? `${formatCalc(metrics.bmiBodyFatPct, 1)}%` : "Selecciona sexo",
        "Ecuacion de Deurenberg: IMC + edad + sexo biologico"
      )}
      ${calcMetricCard(
        "% grasa Navy",
        Number.isFinite(metrics.navyBodyFatPct) ? `${formatCalc(metrics.navyBodyFatPct, 1)}%` : values.sex === "femenino" ? "Falta cintura, cuello o cadera" : "Falta cintura o cuello",
        values.sex === "no especificado"
          ? "Selecciona sexo para usar la formula Navy"
          : "Usa cintura relajada, cuello y altura; en mujeres tambien cadera",
        Number.isFinite(metrics.navyBodyFatPct) ? calcActionButton("navy-body-fat", "Aplicar al campo") : ""
      )}
      ${calcMetricCard(
        "Composicion estimada",
        Number.isFinite(metrics.fatMassLb) ? `${formatCalc(metrics.fatMassLb, 1)} lb grasa` : "Datos incompletos",
        Number.isFinite(metrics.referenceBodyFatPct)
          ? `${compositionSubtext} · fuente: ${metrics.referenceBodyFatSource}`
          : compositionSubtext
      )}
      ${calcMetricCard(
        "Gasto diario",
        Number.isFinite(metrics.tdee) ? `${formatCalc(metrics.tdee, 0)} kcal` : "No disponible",
        Number.isFinite(metrics.bmr) ? `${calorieSubtext} · ${metrics.bmrMethod}` : calorieSubtext
      )}
      ${calcMetricCard(
        "Metas sugeridas",
        Number.isFinite(metrics.suggestedCalories) ? `${formatCalc(metrics.suggestedCalories, 0)} kcal` : "Sin sugerencia",
        Number.isFinite(metrics.suggestedCalories)
          ? `Proteina ${formatCalc(metrics.suggestedProteinG, 0)} g · carbos netos ${formatCalc(metrics.suggestedNetCarbsG, 0)} g`
          : "Necesito mas datos para sugerir calorias y proteina",
        Number.isFinite(metrics.suggestedCalories) ? calcActionButton("targets", "Aplicar sugerencias") : ""
      )}
      ${calcMetricCard(
        "Objetivo actual",
        goalSummary,
        values.goalWeightLb > 0 ? `De ${formatCalc(metrics.weightLb, 1)} lb a ${formatCalc(values.goalWeightLb, 1)} lb` : "Define peso meta para medir avance"
      )}
    </div>
    <div class="calc-note-grid">
      <div class="calc-note">
        <strong>Como se calcula:</strong> IMC = peso/altura<sup>2</sup>. El % de grasa por IMC usa la ecuacion adulta de Deurenberg y el Navy usa cinta metrica.
      </div>
      <div class="calc-note">
        <strong>Importante:</strong> en la formula de Deurenberg la codificacion estandar es masculino = 1 y femenino = 0. Si el sexo queda sin definir, esa estimacion no se muestra.
      </div>
      <div class="calc-note">
        <strong>Uso practico:</strong> las metas sugeridas se basan en tu peso, nivel y objetivo. Son una referencia de arranque y no reemplazan indicacion medica o nutricional.
      </div>
    </div>
  `;
}

function renderWarnings() {
  app.innerHTML = `
    <section class="view-header">
      <div>
        <h2>Advertencias importantes</h2>
        <p>Estas notas deben mostrarse dentro de la app porque FitRecord combina entrenamiento, seguimiento corporal y dieta keto.</p>
      </div>
    </section>
    <div class="grid two">
      <section class="panel">
        <h2>Entrenamiento</h2>
        <div class="warning-list">
          ${data.warnings.exercise.map((item) => `<div class="warning-item">${escapeHtml(item)}</div>`).join("")}
        </div>
      </section>
      <section class="panel">
        <h2>Keto y salud</h2>
        <div class="warning-list">
          ${data.warnings.keto.map((item) => `<div class="warning-item">${escapeHtml(item)}</div>`).join("")}
        </div>
      </section>
    </div>
  `;
}

function exerciseCard(exercise, showForm) {
  const expanded = isCardExpanded("exercise", exercise.id);
  return `
    <article class="card exercise-card">
      ${bookPageGallery(exercise.pageImages || [exercise.image].filter(Boolean), exercise.name, "musculacion", expanded)}
      <div class="card-body">
        <div class="tag-row">
          <span class="tag">${escapeHtml(exercise.group)}</span>
          <span class="tag coral">p. ${pageLabel(exercise)}</span>
          <span class="tag">${escapeHtml(exercise.pattern)}</span>
        </div>
        <h3>${escapeHtml(exercise.name)}${exercise.englishName ? ` <span class="muted">/ ${escapeHtml(exercise.englishName)}</span>` : ""}</h3>
        <p>${escapeHtml(exercise.details.purpose)}</p>
        <div class="resource-row">
          <a class="resource-link" href="${youtubeExerciseUrl(exercise)}" target="_blank" rel="noopener">Ver video en YouTube</a>
          <a class="resource-link" href="${youtubeExerciseOptionsUrl(exercise)}" target="_blank" rel="noopener">Opciones con mancuerna y barra</a>
          <span class="muted">Tecnica base y variantes con implementos</span>
        </div>
        ${cardToggle("exercise", exercise.id, expanded)}
        <div class="card-collapsible" ${expanded ? "" : "hidden"}>
          <div class="detail-grid">
            ${detailBlock("Musculos principales", exercise.primaryMuscles)}
            ${detailBlock("Musculos secundarios", exercise.secondaryMuscles)}
            ${detailBlock("Variantes detectadas", (exercise.variants || []).map((variant) => `${variant.number}: ${variant.name}`), true)}
            ${detailBlock("Preparacion", exercise.details.setup, true)}
            ${detailBlock("Ejecucion paso a paso", exercise.details.execution, true)}
            ${detailBlock("Para novatos", exercise.details.beginnerCues, true)}
            ${detailBlock("Para expertos", exercise.details.expertCues, true)}
            ${detailBlock("Errores comunes", exercise.details.mistakes, true)}
            ${detailBlock("Advertencias", exercise.details.warnings, true)}
            ${detailBlock("Variantes", exercise.details.variations, true)}
          </div>
          <p class="muted">Prescripcion base: ${exercise.prescription.sets} series, ${exercise.prescription.reps} reps, descanso ${exercise.prescription.rest}, ${exercise.prescription.intensity}.</p>
          ${showForm ? exerciseLogForm(exercise.id) : ""}
        </div>
      </div>
    </article>
  `;
}

function recipeCard(recipe, showForm) {
  const expanded = isCardExpanded("recipe", recipe.id);
  return `
    <article class="card recipe-card">
      ${bookPageGallery(recipe.pageImages || [recipe.image].filter(Boolean), recipe.name, "keto", expanded)}
      <div class="card-body">
        <div class="tag-row">
          ${recipe.timeMinutes ? `<span class="tag">${recipe.timeMinutes} min</span>` : ""}
          <span class="tag coral">${recipe.macros.netCarbs} g netos</span>
          <span class="tag">${recipe.macros.protein} g proteina</span>
          <span class="tag">p. ${pageLabel(recipe)}</span>
        </div>
        <h3>${escapeHtml(recipe.name)}</h3>
        <p class="muted">${recipe.macros.calories} kcal, ${recipe.macros.fat} g grasa, ${recipe.macros.carbs} g carbos, ${recipe.macros.fiber} g fibra por porcion.</p>
        ${recipe.servingsLabel ? `<p class="muted">Rinde: ${escapeHtml(recipe.servingsLabel)}</p>` : ""}
        ${cardToggle("recipe", recipe.id, expanded)}
        <div class="card-collapsible" ${expanded ? "" : "hidden"}>
          <div class="detail-grid">
            ${detailBlock("Ingredientes", recipe.ingredients, true)}
            ${detailBlock("Preparacion previa", recipe.preparation.setup, true)}
            ${detailBlock("Pasos", recipe.preparation.steps, true)}
            ${detailBlock("Consejos para principiantes", recipe.preparation.beginnerTips, true)}
            ${detailBlock("Sustituciones", recipe.preparation.substitutions, true)}
            ${detailBlock("Conservacion", [recipe.preparation.storage], true)}
            ${detailBlock("Advertencia", [recipe.preparation.warnings], true)}
          </div>
          ${showForm ? mealLogForm(recipe.id) : ""}
        </div>
      </div>
    </article>
  `;
}

function detailBlock(title, items, ordered = false) {
  if (!items || items.length === 0) return "";
  const tag = ordered ? "ol" : "ul";
  return `
    <div class="detail-block ${items.length > 3 ? "full" : ""}">
      <h4>${escapeHtml(title)}</h4>
      <${tag}>
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </${tag}>
    </div>
  `;
}

function bookPageGallery(images, title, type, expanded) {
  if (!images || images.length === 0) {
    return `
      <div class="book-page-gallery is-empty">
        <p>No hay imagen de pagina disponible.</p>
      </div>
    `;
  }
  const visibleImages = expanded ? images : images.slice(0, 1);
  return `
    <div class="book-page-gallery ${type === "keto" ? "recipe-pages" : ""} ${expanded ? "is-expanded" : "is-collapsed"}">
      <div class="book-page-title">
        <strong>${expanded ? "Paginas reales del libro" : "Vista previa del libro"}</strong>
        <span>${images.length} imagen${images.length === 1 ? "" : "es"}</span>
      </div>
      ${visibleImages
        .map(
          (src, index) => `
            <a class="book-page-link" href="${src}" target="_blank" rel="noopener" aria-label="Abrir pagina ${index + 1} de ${escapeHtml(title)}">
              <img src="${src}" alt="Pagina ${index + 1} del libro para ${escapeHtml(title)}" loading="lazy">
              <span>Abrir pagina ${index + 1}</span>
            </a>
          `
        )
        .join("")}
      ${!expanded && images.length > 1 ? `<div class="book-page-more muted">+${images.length - 1} pagina${images.length - 1 === 1 ? "" : "s"} al expandir</div>` : ""}
    </div>
  `;
}

function pageLabel(item) {
  if (item.bookPages && item.bookPages.length > 1) {
    return `${item.bookPages[0]}-${item.bookPages[item.bookPages.length - 1]}`;
  }
  return item.bookPage;
}

function youtubeExerciseUrl(exercise) {
  const searchTerms = [
    exercise.name,
    exercise.englishName,
    "tecnica ejercicio gimnasio"
  ].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerms)}`;
}

function youtubeExerciseOptionsUrl(exercise) {
  const searchTerms = [
    exercise.name,
    exercise.englishName,
    "variantes mancuernas barra tecnica gimnasio"
  ].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerms)}`;
}

function cardToggle(kind, id, expanded) {
  return `
    <button class="card-toggle" type="button" data-toggle-card="${kind}:${id}" aria-expanded="${expanded ? "true" : "false"}">
      <span class="card-toggle-arrow">${expanded ? "^" : "v"}</span>
      <span>${expanded ? "Ver menos" : "Ver mas"}</span>
    </button>
  `;
}

function isCardExpanded(kind, id) {
  return Boolean(state.expandedCards?.[`${kind}:${id}`]);
}

function setCardExpanded(kind, id, expanded) {
  state.expandedCards = state.expandedCards || {};
  state.expandedCards[`${kind}:${id}`] = expanded;
  writeJson(STORE.expandedCards, state.expandedCards);
}

function isKetoPanelCollapsed(profileId) {
  return Boolean(state.ketoPanel?.[profileId]);
}

function setKetoPanelCollapsed(profileId, collapsed) {
  state.ketoPanel = state.ketoPanel || {};
  state.ketoPanel[profileId] = collapsed;
  writeJson(STORE.ketoPanel, state.ketoPanel);
}

function exerciseLogForm(exerciseId) {
  const prefix = `exercise-${exerciseId}-`;
  return `
    <form class="log-form" data-log-exercise="${exerciseId}">
      <div class="form-grid">
        ${field("sets", "Series", 3, "number", "", prefix)}
        ${field("reps", "Reps", 10, "number", "", prefix)}
        ${field("weightLb", "Peso (lb)", 45, "number", "", prefix)}
        ${field("rpe", "RPE", 7, "number", "", prefix)}
        ${field("notes", "Notas", "", "text", "full", prefix)}
      </div>
      <div class="actions">
        <button class="primary" type="submit">Registrar ejercicio</button>
      </div>
    </form>
  `;
}

function mealLogForm(recipeId) {
  const prefix = `meal-${recipeId}-`;
  return `
    <form class="log-form" data-log-meal="${recipeId}">
      <div class="form-grid">
        ${field("servings", "Porciones", 1, "number", "", prefix)}
        ${field("notes", "Notas", "", "text", "wide", prefix)}
      </div>
      <div class="actions">
        <button class="primary" type="submit">Registrar comida</button>
      </div>
    </form>
  `;
}

function bindCommonActions() {
  document.querySelector("[data-toggle-keto-panel]")?.addEventListener("click", () => {
    const profile = activeProfile();
    if (!profile) return;
    setKetoPanelCollapsed(profile.id, !isKetoPanelCollapsed(profile.id));
    render();
  });

  document.querySelectorAll("[data-toggle-card]").forEach((button) => {
    button.addEventListener("click", () => {
      const [kind, id] = button.dataset.toggleCard.split(":");
      setCardExpanded(kind, id, !isCardExpanded(kind, id));
      render();
    });
  });

  document.querySelectorAll("[data-toggle-group]").forEach((button) => {
    button.addEventListener("click", () => {
      const profile = activeProfile();
      if (!profile) return;
      const date = todayKey();
      const current = getWorkoutGroupsForDate(profile.id, date);
      const group = button.dataset.toggleGroup;
      const next = current.includes(group)
        ? current.filter((item) => item !== group)
        : [...current, group];
      setWorkoutGroupsForDate(profile.id, date, next);
      render();
    });
  });

  document.querySelectorAll("[data-apply-groups]").forEach((button) => {
    button.addEventListener("click", () => {
      const profile = activeProfile();
      if (!profile) return;
      const date = todayKey();
      const groups = button.dataset.applyGroups
        .split("|")
        .map((item) => item.trim())
        .filter(Boolean);
      const current = getWorkoutGroupsForDate(profile.id, date);
      const merged = [...new Set([...current, ...groups])];
      setWorkoutGroupsForDate(profile.id, date, merged);
      render();
    });
  });

  document.querySelector("[data-clear-groups]")?.addEventListener("click", () => {
    const profile = activeProfile();
    if (!profile) return;
    setWorkoutGroupsForDate(profile.id, todayKey(), []);
    render();
  });

  document.querySelectorAll("[data-view-jump]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.viewJump;
      setActiveTab(state.view);
      render();
    });
  });

  document.querySelector('[data-action="quick-checkin"]')?.addEventListener("click", () => {
    saveCheckinFromProfile();
    showToast("Chequeo de hoy guardado");
    render();
  });

  document.querySelector('[data-action="download-workout-pdf"]')?.addEventListener("click", () => {
    downloadWorkoutPdf();
  });

  document.querySelectorAll("[data-log-exercise]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      addLog({
        type: "exercise",
        date: todayKey(),
        exerciseId: form.dataset.logExercise,
        sets: numberValue(formData.get("sets")),
        reps: numberValue(formData.get("reps")),
        weightLb: numberValue(formData.get("weightLb")),
        rpe: numberValue(formData.get("rpe")),
        notes: formData.get("notes").trim()
      });
      showToast("Ejercicio registrado");
      render();
    });
  });

  document.querySelectorAll("[data-log-meal]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      addLog({
        type: "meal",
        date: todayKey(),
        recipeId: form.dataset.logMeal,
        servings: numberValue(formData.get("servings")),
        notes: formData.get("notes").trim()
      });
      showToast("Comida registrada");
      render();
    });
  });
}

function downloadWorkoutPdf() {
  const profile = activeProfile();
  if (!profile) return;
  const date = todayKey();
  const dayLogs = logsForDate(date);
  const selectedGroups = getWorkoutGroupsForDate(profile.id, date);
  const plan = generateTrainingPlan(profile, selectedGroups);
  const pdfBytes = buildWorkoutPdf(profile, plan, dayLogs, date, selectedGroups);
  const filename = `fitrecord-entrenamiento-${slugify(profile.name)}-${date}.pdf`;
  downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), filename);
  showToast("Entrenamiento del dia descargado en PDF");
}

function downloadProfileJson(profilePayload) {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    app: "FitRecord",
    profile: profilePayload,
    logs: state.logs.filter((item) => item.profileId === profilePayload.id),
    workoutSelections: state.workoutSelections?.[profilePayload.id] ?? {}
  };
  const filename = `fitrecord-perfil-${slugify(profilePayload.name)}.json`;
  downloadBlob(
    new Blob([`${JSON.stringify(exportPayload, null, 2)}\n`], { type: "application/json;charset=utf-8" }),
    filename
  );
  showToast("Perfil descargado en JSON");
}

function buildWorkoutPdf(profile, plan, dayLogs, date, selectedGroups) {
  const lines = [];
  const macros = totalMacros(dayLogs.meals);
  const volume = volumeForLogs(dayLogs.exercises);
  const selectedLabel = selectedGroups.length > 0 ? selectedGroups.join(", ") : "Sin seleccion manual";

  lines.push({ text: "FITRECORD", size: 18, gapAfter: 10 });
  lines.push({ text: `Entrenamiento del dia - ${date}`, size: 14, gapAfter: 6 });
  lines.push({ text: `Perfil: ${profile.name}`, size: 11 });
  lines.push({ text: `Enfoque: ${plan.focus}`, size: 11 });
  lines.push({ text: `Grupos elegidos: ${selectedLabel}`, size: 11 });
  lines.push({ text: `Resumen: peso ${profile.currentWeightLb} lb | volumen hoy ${volume.toLocaleString()} lb | carbos netos ${macros.netCarbs} g`, size: 11, gapAfter: 10 });

  if (plan.exercises.length === 0) {
    lines.push({ text: "No hay ejercicios seleccionados para hoy.", size: 11, gapAfter: 6 });
  }

  plan.exercises.forEach((exercise, index) => {
    const exerciseLogs = dayLogs.exercises.filter((log) => log.exerciseId === exercise.id);
    const mainMuscles = (exercise.primaryMuscles || []).join(", ") || "No especificados";
    const secondaryMuscles = (exercise.secondaryMuscles || []).join(", ") || "No especificados";
    const prescription = `${exercise.prescription.sets} series, ${exercise.prescription.reps} reps, descanso ${exercise.prescription.rest}, ${exercise.prescription.intensity}`;
    const videoUrl = youtubeExerciseUrl(exercise);

    lines.push({ text: `${index + 1}. ${exercise.name}${exercise.englishName ? ` / ${exercise.englishName}` : ""}`, size: 13, gapAfter: 4 });
    lines.push({ text: `Grupo: ${exercise.group} | Patron: ${exercise.pattern} | Paginas: ${pageLabel(exercise)}`, size: 10 });
    lines.push({ text: `Objetivo: ${exercise.details.purpose}`, size: 10 });
    lines.push({ text: `Musculos principales: ${mainMuscles}`, size: 10 });
    lines.push({ text: `Musculos secundarios: ${secondaryMuscles}`, size: 10 });
    lines.push({ text: `Prescripcion base: ${prescription}`, size: 10 });

    if (exerciseLogs.length > 0) {
      exerciseLogs.forEach((log, logIndex) => {
        lines.push({
          text: `Registro ${logIndex + 1}: ${log.sets} x ${log.reps} x ${log.weightLb} lb | RPE ${log.rpe || 0}${log.notes ? ` | notas: ${log.notes}` : ""}`,
          size: 10
        });
      });
    } else {
      lines.push({ text: "Registro de hoy: aun no se ha cargado una serie para este ejercicio.", size: 10 });
    }

    lines.push({ text: `Video YouTube: ${videoUrl}`, size: 10, link: videoUrl });
    lines.push({ text: `Advertencias: ${(exercise.details.warnings || []).join("; ") || "Revisar tecnica antes de subir la carga."}`, size: 10, gapAfter: 10 });
  });

  lines.push({ text: "Advertencia general: este PDF es una ayuda de referencia. Ajusta la tecnica, el rango de movimiento y la carga a tu movilidad, dolor y condicion medica.", size: 10, gapAfter: 0 });
  return createSimplePdf(lines);
}

function createSimplePdf(lines) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 48;
  const topY = 750;
  const bottomY = 48;
  const pageCharLimits = { 18: 56, 14: 76, 13: 82, 11: 98, 10: 110 };
  const pages = [];
  let currentPage = { commands: [], annotations: [] };
  let y = topY;

  const pushPage = () => {
    pages.push(currentPage);
    currentPage = { commands: [], annotations: [] };
    y = topY;
  };

  const ensureRoom = (heightNeeded) => {
    if (y - heightNeeded < bottomY) {
      pushPage();
    }
  };

  lines.forEach((item) => {
    const fontSize = item.size || 11;
    const lineHeight = Math.round(fontSize * 1.45);
    const maxChars = item.maxChars || pageCharLimits[fontSize] || 96;
    const wrapped = wrapPdfText(asciiPdfText(item.text), maxChars);
    const blockHeight = Math.max(1, wrapped.length) * lineHeight + (item.gapAfter || 0);
    ensureRoom(blockHeight);

    wrapped.forEach((line) => {
      currentPage.commands.push(`BT /F1 ${fontSize} Tf ${marginX} ${y} Td (${escapePdfText(line)}) Tj ET`);
      if (item.link) {
        const width = Math.min(pageWidth - marginX * 2, estimatePdfTextWidth(line, fontSize));
        currentPage.annotations.push({
          x1: marginX,
          y1: y - 3,
          x2: marginX + width,
          y2: y + fontSize,
          url: item.link
        });
      }
      y -= lineHeight;
    });

    y -= item.gapAfter || 0;
  });

  if (currentPage.commands.length > 0 || currentPage.annotations.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  const objects = [null];
  const pushObject = (content) => {
    const id = objects.length;
    objects.push(content);
    return id;
  };

  const pagesId = pushObject("");
  const fontId = pushObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds = [];

  pages.forEach((page) => {
    const stream = page.commands.join("\n");
    const contentId = pushObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    const annotationIds = page.annotations.map((annotation) => {
      return pushObject(
        `<< /Type /Annot /Subtype /Link /Rect [${annotation.x1} ${annotation.y1} ${annotation.x2} ${annotation.y2}] /Border [0 0 0] /A << /S /URI /URI (${escapePdfText(annotation.url)}) >> >>`
      );
    });
    const annotationsPart = annotationIds.length > 0 ? `/Annots [${annotationIds.map((id) => `${id} 0 R`).join(" ")}]` : "";
    const pageId = pushObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R ${annotationsPart} >>`
    );
    pageIds.push(pageId);
  });

  objects[pagesId] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`;
  const catalogId = pushObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function wrapPdfText(text, maxChars = 100) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    if (word.length > maxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      return;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxChars) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function asciiPdfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[^ -~]/g, " ");
}

function escapePdfText(value) {
  return String(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function estimatePdfTextWidth(text, fontSize) {
  return Math.max(36, text.length * fontSize * 0.52);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function slugify(value) {
  const cleaned = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "usuario";
}

function saveCheckinFromProfile() {
  const profile = activeProfile();
  addLog({
    type: "checkin",
    date: todayKey(),
    weightLb: profile.currentWeightLb,
    bodyFatPct: profile.bodyFatPct,
    muscleMassLb: profile.muscleMassLb,
    waistIn: profile.waistIn,
    chestIn: profile.chestIn,
    hipsIn: profile.hipsIn,
    armIn: profile.armIn,
    thighIn: profile.thighIn
  });
}

function addLog(log) {
  const profile = activeProfile();
  if (!profile) return;
  if (log.type === "checkin") {
    state.logs = state.logs.filter(
      (item) => !(item.profileId === profile.id && item.type === "checkin" && item.date === log.date)
    );
  }
  state.logs.push({ ...log, id: crypto.randomUUID(), profileId: profile.id, createdAt: new Date().toISOString() });
  writeJson(STORE.logs, state.logs);
}

function logsForDate(date) {
  const profile = activeProfile();
  const logs = state.logs.filter((log) => log.profileId === profile?.id && log.date === date);
  return {
    checkin: logs.find((log) => log.type === "checkin"),
    exercises: logs.filter((log) => log.type === "exercise"),
    meals: logs.filter((log) => log.type === "meal")
  };
}

function generateTrainingPlan(profile, selectedGroups = []) {
  if (selectedGroups.length > 0) {
    const selected = selectedGroups
      .flatMap((group, index) => pickExercisesByGroup(group, index === 0 ? 2 : 1, index * 7 + new Date().getDay()))
      .filter((exercise, index, array) => array.findIndex((item) => item.id === exercise.id) === index);
    return {
      focus: `Rutina personalizada: ${selectedGroups.join(" + ")}`,
      exercises: selected
    };
  }

  const day = new Date().getDay();
  const focusMap = [
    ["Recuperacion activa y tecnica", ["Abdomen y lumbar", "Hombros y cuello", "Biceps"]],
    ["Empuje: pectoral, hombros y triceps", ["Pectoral", "Hombros y cuello", "Triceps", "Abdomen y lumbar"]],
    ["Piernas completas", ["Piernas", "Piernas", "Abdomen y lumbar"]],
    ["Traccion: espalda y biceps", ["Dorsal", "Dorsal", "Biceps", "Antebrazos"]],
    ["Hipertrofia general", ["Pectoral", "Dorsal", "Piernas", "Triceps"]],
    ["Fuerza de basicos", ["Piernas", "Pectoral", "Dorsal", "Abdomen y lumbar"]],
    ["Sesion mixta controlada", ["Dorsal", "Hombros y cuello", "Biceps", "Abdomen y lumbar"]]
  ];
  const [focus, groups] = focusMap[day];
  const selected = groups
    .map((group, index) => pickExerciseByGroup(group, day + index * 5))
    .filter(Boolean);
  return { focus, exercises: selected };
}

function generateMealPlan(profile) {
  const day = new Date().getDay();
  const breakfast = pickRecipeByType("desayuno", day);
  const lunch = pickRecipeByType("comida", day + 2);
  const dinner = pickRecipeByType("cena", day + 4);
  const snack = pickRecipeByType("snack", day + 6) || pickRecipeByType("postre", day + 6);
  return [breakfast, lunch, dinner, snack].filter(Boolean);
}

function pickExerciseByGroup(group, offset) {
  const options = data.exercises.filter((exercise) => exercise.group === group);
  if (options.length === 0) return null;
  return options[offset % options.length];
}

function pickExercisesByGroup(group, count, offset) {
  const options = data.exercises.filter((exercise) => exercise.group === group);
  if (options.length === 0) return [];
  return Array.from({ length: Math.min(count, options.length) }, (_item, index) => {
    return options[(offset + index) % options.length];
  });
}

function pickRecipeByType(type, offset) {
  const options = data.recipes.filter((recipe) => recipe.mealType === type);
  if (options.length === 0) return null;
  return options[offset % options.length];
}

function getWorkoutGroupsForDate(profileId, date) {
  return state.workoutSelections?.[profileId]?.[date] ?? [];
}

function setWorkoutGroupsForDate(profileId, date, groups) {
  state.workoutSelections = state.workoutSelections || {};
  state.workoutSelections[profileId] = state.workoutSelections[profileId] || {};
  state.workoutSelections[profileId][date] = groups;
  writeJson(STORE.workoutSelections, state.workoutSelections);
}

function getSuggestedGroups(selectedGroups) {
  if (selectedGroups.length === 0) {
    return ["Pectoral", "Dorsal", "Piernas", "Abdomen y lumbar"];
  }
  const first = selectedGroups[0];
  return (GROUP_COMBOS[first] || []).filter((group) => !selectedGroups.includes(group));
}

function totalMacros(mealLogs) {
  return mealLogs.reduce(
    (sum, meal) => {
      const recipe = data.recipes.find((item) => item.id === meal.recipeId);
      if (!recipe) return sum;
      const servings = meal.servings || 1;
      return {
        calories: Math.round(sum.calories + recipe.macros.calories * servings),
        fat: Math.round(sum.fat + recipe.macros.fat * servings),
        protein: Math.round(sum.protein + recipe.macros.protein * servings),
        netCarbs: Math.round(sum.netCarbs + recipe.macros.netCarbs * servings)
      };
    },
    { calories: 0, fat: 0, protein: 0, netCarbs: 0 }
  );
}

function volumeForLogs(exerciseLogs) {
  return exerciseLogs.reduce((sum, log) => sum + log.sets * log.reps * log.weightLb, 0);
}

function lastSevenDays() {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return todayKey(date);
  });
}

function weeklyRow(row, netCarbTarget) {
  const volume = volumeForLogs(row.dayLogs.exercises);
  const carbPct = Math.min(100, Math.round((row.macros.netCarbs / Math.max(1, netCarbTarget)) * 100));
  return `
    <tr>
      <td>${row.date}</td>
      <td>
        ${row.checkin ? `${row.checkin.weightLb} lb, ${row.checkin.muscleMassLb} lb masa, cintura ${row.checkin.waistIn} in` : '<span class="muted">Sin chequeo</span>'}
      </td>
      <td>${row.dayLogs.exercises.length} ejercicios</td>
      <td>
        ${row.dayLogs.meals.length} comidas, ${row.macros.netCarbs} g netos
        <div class="bar" aria-hidden="true"><span style="width:${carbPct}%"></span></div>
      </td>
      <td>${volume.toLocaleString()} lb</td>
    </tr>
  `;
}

function metric(label, value, subtext) {
  return `
    <div class="metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(String(subtext))}</small>
    </div>
  `;
}

function sourceSummary() {
  if (!usingGeneratedBooks) return "";
  const counts = data.counts ?? {};
  return `
    <div class="tag-row">
      <span class="tag">${counts.exercises ?? data.exercises.length} ejercicios del libro</span>
      <span class="tag">${counts.recipes ?? data.recipes.length} recetas keto</span>
      <span class="tag coral">imagenes locales privadas</span>
    </div>
  `;
}

function groupToggle(group, selected) {
  return `
    <button class="group-chip ${selected ? "is-selected" : ""}" type="button" data-toggle-group="${escapeHtml(group)}" aria-pressed="${selected ? "true" : "false"}">
      <span class="group-chip-mark">${selected ? "Activo" : "Agregar"}</span>
      <strong>${escapeHtml(group)}</strong>
    </button>
  `;
}

function suggestionButton(group) {
  return `
    <button class="builder-suggestion" type="button" data-apply-groups="${escapeHtml(group)}">
      ${escapeHtml(group)}
    </button>
  `;
}

function templateButton(template) {
  return `
    <button class="template-chip" type="button" data-apply-groups="${escapeHtml(template.groups.join("|"))}">
      <strong>${escapeHtml(template.label)}</strong>
      <span>${escapeHtml(template.groups.join(" + "))}</span>
    </button>
  `;
}

function field(name, label, value, type = "text", extraClass = "", idPrefix = "") {
  const id = `${idPrefix}${name}`;
  return `
    <div class="field ${extraClass}">
      <label for="${id}">${label}</label>
      <input id="${id}" name="${name}" type="${type}" value="${escapeHtml(String(value))}" ${type === "number" ? 'step="0.1"' : ""}>
    </div>
  `;
}

function selectField(name, label, value, options) {
  return `
    <div class="field">
      <label for="${name}">${label}</label>
      <select id="${name}" name="${name}">
        ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    </div>
  `;
}

function textArea(name, label, value, extraClass = "") {
  return `
    <div class="field ${extraClass}">
      <label for="${name}">${label}</label>
      <textarea id="${name}" name="${name}">${escapeHtml(value)}</textarea>
    </div>
  `;
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calcMetricCard(label, value, subtext, actions = "") {
  return `
    <article class="metric calc-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(subtext)}</small>
      ${actions ? `<div class="calc-actions">${actions}</div>` : ""}
    </article>
  `;
}

function calcActionButton(action, label) {
  return `<button class="secondary calc-action" type="button" data-apply-calc="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
}

function heightFeet(inches) {
  const feet = Math.floor(inches / 12);
  const rest = Math.round(inches % 12);
  return `${feet} ft ${rest} in`;
}

function roundTo(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function firstFinite(...values) {
  return values.find((value) => Number.isFinite(value)) ?? null;
}

function toKg(pounds) {
  return pounds / 2.2046226218;
}

function toCm(inches) {
  return inches * 2.54;
}

function toMeters(inches) {
  return inches * 0.0254;
}

function formatCalc(value, digits = 1) {
  if (!Number.isFinite(value)) return "No disponible";
  return roundTo(value, digits).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

function deurenbergSexCode(sex) {
  if (sex === "masculino") return 1;
  if (sex === "femenino") return 0;
  return null;
}

function bmiCategory(bmi) {
  if (!Number.isFinite(bmi)) return "Sin clasificar";
  if (bmi < 18.5) return "Bajo peso";
  if (bmi < 25) return "Rango saludable";
  if (bmi < 30) return "Sobrepeso";
  return "Obesidad";
}

function bodyFatSourceLabel(navyBodyFatPct, recordedBodyFatPct, bmiBodyFatPct) {
  if (Number.isFinite(navyBodyFatPct)) return "Navy";
  if (Number.isFinite(recordedBodyFatPct)) return "perfil";
  if (Number.isFinite(bmiBodyFatPct)) return "IMC + edad + sexo";
  return "sin fuente";
}

function bmrMethodLabel(sex, leanMassLb) {
  if (sex === "masculino" || sex === "femenino") return "Mifflin-St Jeor";
  if (Number.isFinite(leanMassLb)) return "Katch-McArdle";
  return "sin metodo";
}

function activityFactorForLevel(level) {
  const factors = {
    novato: 1.375,
    intermedio: 1.55,
    avanzado: 1.725
  };
  return factors[level] ?? 1.375;
}

function goalCalorieAdjustment(goal) {
  const adjustments = {
    "bajar grasa": -350,
    "ganar masa": 250,
    fuerza: 120,
    "ganar masa y bajar grasa": -100,
    mantenimiento: 0
  };
  return adjustments[goal] ?? 0;
}

function proteinSuggestion(goal, weightLb, leanMassLb) {
  const base = Number.isFinite(leanMassLb) && leanMassLb > 0 ? leanMassLb : weightLb;
  const multipliers = {
    "bajar grasa": 1,
    "ganar masa": 0.9,
    fuerza: 0.9,
    "ganar masa y bajar grasa": 1,
    mantenimiento: 0.8
  };
  return base * (multipliers[goal] ?? 0.9);
}

function netCarbSuggestion(goal) {
  const targets = {
    "bajar grasa": 20,
    "ganar masa": 30,
    fuerza: 30,
    "ganar masa y bajar grasa": 25,
    mantenimiento: 25
  };
  return targets[goal] ?? 25;
}

function signed(value, unit) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded} ${unit}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
