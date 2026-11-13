(function () {
  const rawData = window.FITRECORD_GENERATED_DATA || window.FITRECORD_DATA || {
    exercises: [],
    recipes: [],
    warnings: { exercise: [], keto: [] }
  };

  const EXERCISES = Array.isArray(rawData.exercises) ? rawData.exercises : [];
  const RECIPES = Array.isArray(rawData.recipes) ? rawData.recipes : [];
  const WARNINGS = rawData.warnings || { exercise: [], keto: [] };

  const EXERCISE_BY_ID = new Map(EXERCISES.map((ex) => [String(ex.id), ex]));
  const RECIPE_BY_ID = new Map(RECIPES.map((rx) => [String(rx.id), rx]));

  const STORAGE_KEY = 'fitrecord-neon-v3-state';
  const todayIso = () => new Date().toISOString().slice(0, 10);

  // ── PWA Service Worker & Install Prompt ───────────────────
  let deferredInstallPrompt = null;
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
  });

  // ── Classification Constants ──────────────────────────────
  const MODALITY_OPTIONS = [
    { id: 'todas', label: '⚡ Todas las Modalidades', short: 'Todas', desc: 'Combina pesas, máquinas, poleas y peso corporal' },
    { id: 'pesas_libres', label: '🏋️ Pesas Libres', short: 'Pesas Libres', desc: 'Barras, mancuernas, barra Z y pesas rusas' },
    { id: 'maquinas', label: '⚙️ Máquinas Guiadas', short: 'Máquinas', desc: 'Recorrido guiado y estable en máquina o Smith' },
    { id: 'poleas', label: '⛓️ Poleas y Cables', short: 'Poleas', desc: 'Tensión continua y cuidada para articulaciones' },
    { id: 'peso_corporal', label: '🤸 Peso Corporal (Mismo Esfuerzo)', short: 'Peso Corporal', desc: 'Autocarga y calistenia con tu propio cuerpo' },
    { id: 'bandas_funcional', label: '🎗️ Bandas y Funcional', short: 'Bandas / Funcional', desc: 'Bandas elásticas, fitball, bosu y rueda' },
    { id: 'cardio_ergometros', label: '🏃 Cardio y Ergómetros', short: 'Cardio / Caminadora', desc: 'Caminadora, bicicleta estática, elíptica y cuerda' }
  ];

  const EQUIPMENT_CHIPS = [
    { id: 'peso_corporal', label: '🤸 Peso corporal (Sin equipo)', matches: ['body weight', 'assisted'] },
    { id: 'mancuernas', label: '🏋️ Mancuernas', matches: ['dumbbell', 'kettlebell'] },
    { id: 'barra', label: '🏋️‍♂️ Barra y discos', matches: ['barbell', 'ez barbell', 'olympic barbell', 'trap bar', 'weighted'] },
    { id: 'maquinas', label: '⚙️ Máquinas de gimnasio', matches: ['leverage machine', 'smith machine', 'sled machine', 'assisted'] },
    { id: 'poleas', label: '⛓️ Poleas / Cables', matches: ['cable', 'rope'] },
    { id: 'bandas', label: '🎗️ Bandas y funcional', matches: ['band', 'resistance band', 'stability ball', 'bosu ball', 'medicine ball', 'wheel roller', 'roller'] },
    { id: 'cardio', label: '🏃 Caminadora / Bici / Elíptica', matches: ['treadmill', 'stationary bike', 'elliptical machine', 'stepmill machine', 'skierg machine', 'upper body ergometer', 'rope'] }
  ];

  const INJURY_CHIPS = [
    { id: 'hombro', label: '🦴 Hombro / Manguito rotador', desc: 'Evita presses trasnuca, fondos profundos y remos al mentón agresivos.' },
    { id: 'rodilla', label: '🦵 Rodilla / Menisco', desc: 'Evita saltos pliométricos, impactos altos y flexiones profundas forzadas.' },
    { id: 'lumbar', label: '⚡ Espalda baja / Lumbar', desc: 'Sustituye peso muerto pesado y remos libres inclinados por variantes con soporte.' },
    { id: 'muneca_codo', label: '💪 Muñeca / Codo (Epicondilitis)', desc: 'Prioriza agarres neutros, poleas y evita barras rectas rígidas.' },
    { id: 'cervical', label: '🧣 Cuello / Cervical', desc: 'Elimina carga axial sobre trapecio superior y tensión cervical.' },
    { id: 'cadera_tobillo', label: '🦶 Cadera / Tobillo', desc: 'Reduce impactos de carrera/salto y prioriza cardio sin impacto o máquinas.' }
  ];

  const MEDICAL_CHIPS = [
    { id: 'hipertension', label: '❤️ Hipertensión / Presión alta', desc: 'Limita RPE máximo a ≤8, prohíbe apnea (Valsalva) y sugiere control de sodio en Keto.' },
    { id: 'diabetes', label: '🩸 Diabetes / Resistencia a insulina', desc: 'Ajusta carbohidratos netos meta a ≤18 g/día y prioriza fuerza + cardio postprandial.' },
    { id: 'colesterol', label: '🥑 Colesterol / Triglicéridos', desc: 'Prioriza grasas monoinsaturadas y omega-3 (salmón, aguacate, aceite de oliva) en Plan Keto.' },
    { id: 'renal_gota', label: '💧 Cuidado renal / Ácido úrico', desc: 'Modera la proteína diaria a ~0.75 g/lb magra y enfatiza hidratación constante.' },
    { id: 'hipotiroidismo', label: '🦋 Hipotiroidismo / Metabolismo lento', desc: 'Ajusta factor metabólico basal (-7%) y prioriza sesiones de fuerza progresiva.' }
  ];

  const ROUTINE_GROUPS = [
    'Pectoral',
    'Dorsal y espalda',
    'Hombros y cuello',
    'Bíceps',
    'Tríceps',
    'Piernas y glúteos',
    'Pantorrillas',
    'Abdomen y core',
    'Cardio y HIIT',
    'Antebrazos'
  ];

  // Boostcamp / WorkoutGen Inspired Coach Programs
  const COACH_PROGRAMS = [
    {
      id: 'ppl-push',
      title: 'Push / Empuje Hipertrofia (Estilo Hevy & Boostcamp)',
      coach: 'Programa Clásico Gimnasio · Día 1',
      level: 'Todos los niveles',
      modality: 'todas',
      groups: ['Pectoral', 'Hombros y cuello', 'Tríceps'],
      desc: 'Enfocado en pectorales, deltoides y tríceps combinando empujes compuestos y aislamiento.'
    },
    {
      id: 'ppl-pull',
      title: 'Pull / Tracción Espalda y Bíceps (Estilo Boostcamp)',
      coach: 'Programa Clásico Gimnasio · Día 2',
      level: 'Todos los niveles',
      modality: 'todas',
      groups: ['Dorsal y espalda', 'Bíceps', 'Antebrazos'],
      desc: 'Tracción vertical y horizontal para amplitud dorsal, densidad de espalda y bíceps.'
    },
    {
      id: 'ppl-legs',
      title: 'Legs / Pierna Completa, Glúteo y Core',
      coach: 'Programa Clásico Gimnasio · Día 3',
      level: 'Todos los niveles',
      modality: 'todas',
      groups: ['Piernas y glúteos', 'Pantorrillas', 'Abdomen y core'],
      desc: 'Dominantes de rodilla, bisagra de cadera, gemelos y estabilidad abdominal.'
    },
    {
      id: 'machines-guiado',
      title: 'Circuito Guiado en Máquinas y Poleas (Estilo JEFIT)',
      coach: 'Ideal Principiantes o Cuidado Articular',
      level: 'Principiante (Novato)',
      modality: 'maquinas',
      groups: ['Pectoral', 'Dorsal y espalda', 'Piernas y glúteos'],
      desc: 'Recorrido 100% guiado en máquinas para máxima estabilidad técnica y cero estrés articular.'
    },
    {
      id: 'calistenia-casa',
      title: 'Peso Corporal / Mismo Esfuerzo (Sin Gimnasio)',
      coach: 'Entrenamiento en Casa o Parque',
      level: 'Todos los niveles',
      modality: 'peso_corporal',
      groups: ['Pectoral', 'Dorsal y espalda', 'Piernas y glúteos', 'Abdomen y core'],
      desc: 'Trabaja todos los grupos musculares usando únicamente el esfuerzo de tu propio peso corporal.'
    },
    {
      id: 'keto-burn-hiit',
      title: 'Quema Grasa Metabólica: Cardio + Fuerza Total',
      coach: 'Especial Recomposición & Keto',
      level: 'Todos los niveles',
      modality: 'todas',
      groups: ['Cardio y HIIT', 'Piernas y glúteos', 'Abdomen y core'],
      desc: 'Maximiza la oxidación calórica combinando cardio por tiempo (caminadora/bici/HIIT) y grandes grupos musculares.'
    }
  ];

  // Meal Type Normalization (Fixes "almuerzo" -> "comida" so all 20 Lunch/Salad/Soup recipes show up!)
  const MEAL_CATEGORIES = [
    { id: 'todos', label: '🍽️ Todas las Recetas', match: () => true },
    { id: 'desayuno', label: '🌅 Desayunos y Smoothies', match: (r) => r.mealType === 'desayuno' },
    { id: 'almuerzo', label: '☀️ Almuerzos, Sopas y Ensaladas', match: (r) => r.mealType === 'comida' || r.mealType === 'almuerzo' },
    { id: 'cena', label: '🌙 Cenas (Pescados, Aves y Carnes)', match: (r) => r.mealType === 'cena' },
    { id: 'snack', label: '🧀 Snacks y Guarniciones', match: (r) => r.mealType === 'snack' },
    { id: 'postre', label: '🍫 Postres y Golosinas Keto', match: (r) => r.mealType === 'postre' },
    { id: 'salsa', label: '🥣 Salsas y Aderezos Keto', match: (r) => r.mealType === 'salsa' }
  ];

  function getMealBadgeLabel(mealType) {
    if (mealType === 'desayuno') return '🌅 Desayuno';
    if (mealType === 'comida' || mealType === 'almuerzo') return '☀️ Almuerzo / Ensalada';
    if (mealType === 'cena') return '🌙 Cena';
    if (mealType === 'snack') return '🧀 Snack / Guarnición';
    if (mealType === 'postre') return '🍫 Postre Keto';
    if (mealType === 'salsa') return '🥣 Salsa / Aderezo';
    return '🥑 Keto';
  }

  // ── Default Profile & State ───────────────────────────────
  function createDefaultProfile(name = 'Mi Perfil Principal') {
    return {
      id: 'prof-' + Math.random().toString(36).slice(2, 9),
      name,
      sex: 'hombre',
      age: 30,
      heightUnit: 'ft_in',
      heightIn: 69,
      weightLb: 182,
      level: 'intermedio',
      goal: 'recomposicion',
      preferredModality: 'todas',
      useTapeMeasurements: false,
      manualBodyCompOverride: false,
      neckIn: 15.5,
      waistIn: 34,
      chestIn: 40,
      hipIn: 39,
      armIn: 14,
      thighIn: 22,
      bodyFatPct: 18.5,
      leanMassLb: 148.3,
      caloriesTarget: 2150,
      proteinTarget: 155,
      netCarbTarget: 22,
      equipmentTags: ['peso_corporal', 'mancuernas', 'barra', 'maquinas', 'poleas', 'cardio'],
      injuryTags: [],
      medicalTags: []
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('fitrecord-neon-v2-state');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
          if (!parsed.activeView || parsed.activeView === 'today') parsed.activeView = 'dashboard';
          if (!parsed.profileSubTab) parsed.profileSubTab = 'biometria';
          if (!parsed.nutritionFilter) parsed.nutritionFilter = { search: '', mealType: 'todos', maxNetCarbs: 99, limit: 24 };
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Error loading state:', e);
    }
    const defProf = createDefaultProfile('Mi Perfil Principal');
    return {
      activeView: 'dashboard', // 'dashboard' | 'workout' | 'programs' | 'library' | 'nutrition' | 'profile'
      sidebarCollapsed: false,
      activeProfileId: defProf.id,
      profiles: [defProf],
      selectedDate: todayIso(),
      openWorkoutExerciseId: null, // Accordion focus in 'workout' view
      profileSubTab: 'biometria',  // 'biometria' | 'salud' | 'historial'
      selectedGroupsByDate: {},
      customRoutineIdsByDate: {},
      swappedExerciseBySlot: {},
      cardBranchTabByEx: {},
      trackingModeOverride: {},
      favorites: [],
      workoutLogs: [],
      nutritionLogs: [],
      checkedIngredients: {},
      libraryFilter: {
        search: '',
        group: 'Todos',
        modality: 'todas',
        level: 'todos',
        trackingType: 'todos',
        onlyFavorites: false,
        limit: 24
      },
      nutritionFilter: {
        search: '',
        mealType: 'todos',
        maxNetCarbs: 99,
        limit: 24
      }
    };
  }

  const state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }

  function getActiveProfile() {
    let p = state.profiles.find((x) => x.id === state.activeProfileId) || state.profiles[0];
    if (!p) {
      p = createDefaultProfile();
      state.profiles = [p];
      state.activeProfileId = p.id;
    }
    if (!p.heightUnit) p.heightUnit = 'ft_in';
    if (typeof p.useTapeMeasurements !== 'boolean') p.useTapeMeasurements = false;
    if (!p.preferredModality) p.preferredModality = 'todas';
    if (!Array.isArray(p.equipmentTags)) p.equipmentTags = ['peso_corporal', 'mancuernas', 'barra', 'maquinas', 'poleas', 'cardio'];
    if (!Array.isArray(p.injuryTags)) p.injuryTags = [];
    if (!Array.isArray(p.medicalTags)) p.medicalTags = [];
    return p;
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => el.classList.remove('is-visible'), 3200);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Per-Exercise & Global Timer Engine ────────────────────
  // Works both in the topbar AND directly inside any opened exercise card or modal!
  const exTimerState = {
    activeExId: null,
    running: false,
    seconds: 60,
    initialSeconds: 60,
    mode: 'countdown', // 'countdown' | 'stopwatch'
    intervalId: null
  };

  function formatClock(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }

  function syncAllTimerDisplays() {
    const text = formatClock(exTimerState.seconds);
    const topDisp = document.getElementById('restTimerDisplay');
    if (topDisp) topDisp.textContent = text;
    document.querySelectorAll('.js-ex-timer-digits').forEach((el) => {
      el.textContent = text;
    });
    document.querySelectorAll('.js-ex-timer-toggle-btn').forEach((btn) => {
      btn.textContent = exTimerState.running ? '⏸ Pausar' : '▶ Iniciar';
    });
  }

  function startGlobalOrExerciseTimer(seconds, exId = null, mode = 'countdown') {
    if (seconds !== null && seconds !== undefined) {
      exTimerState.seconds = Number(seconds);
      exTimerState.initialSeconds = Number(seconds);
    }
    if (exId) exTimerState.activeExId = String(exId);
    exTimerState.mode = mode;
    exTimerState.running = true;

    clearInterval(exTimerState.intervalId);
    syncAllTimerDisplays();

    exTimerState.intervalId = setInterval(() => {
      if (exTimerState.mode === 'stopwatch') {
        exTimerState.seconds++;
      } else {
        exTimerState.seconds--;
        if (exTimerState.seconds <= 0) {
          exTimerState.seconds = 0;
          exTimerState.running = false;
          clearInterval(exTimerState.intervalId);
          showToast('⚡ ¡Tiempo completado! Puedes registrar tu serie o iniciar la siguiente.');
        }
      }
      syncAllTimerDisplays();
    }, 1000);
  }

  function toggleExerciseTimer(exId, defaultSec = 60) {
    if (exTimerState.running) {
      exTimerState.running = false;
      clearInterval(exTimerState.intervalId);
      syncAllTimerDisplays();
    } else {
      if (exTimerState.seconds <= 0) {
        exTimerState.seconds = defaultSec;
      }
      startGlobalOrExerciseTimer(exTimerState.seconds, exId, exTimerState.mode);
    }
  }

  function resetExerciseTimer(sec = 60) {
    exTimerState.running = false;
    clearInterval(exTimerState.intervalId);
    exTimerState.seconds = Number(sec) || 0;
    exTimerState.initialSeconds = exTimerState.seconds;
    syncAllTimerDisplays();
  }

  function renderEmbeddedExerciseTimer(ex) {
    const defaultSec = ex.trackingType === 'time_cardio'
      ? (ex.defaultMinutes || 15) * 60
      : ex.trackingType === 'time_isometric'
      ? (ex.defaultSeconds || 45)
      : 90;

    return `
      <div class="exercise-timer-box">
        <div class="ex-timer-clock">
          <div>
            <span class="eyebrow" style="font-size:0.66rem;display:block;">⏱️ TIMER INTEGRADO DEL EJERCICIO</span>
            <strong class="ex-timer-digits js-ex-timer-digits">${formatClock(exTimerState.seconds || defaultSec)}</strong>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <button type="button" class="ex-timer-btn js-ex-timer-toggle-btn" data-action="ex-timer-toggle" data-ex-id="${escapeHtml(ex.id)}" data-default-sec="${defaultSec}">
              ${exTimerState.running ? '⏸ Pausar' : '▶ Iniciar'}
            </button>
            <button type="button" class="secondary ex-timer-btn" data-action="ex-timer-stopwatch" data-ex-id="${escapeHtml(ex.id)}" title="Contar hacia arriba desde 00:00">
              ⏱️ Cronómetro 0→∞
            </button>
          </div>
        </div>

        <div class="ex-timer-controls">
          <button type="button" class="secondary ex-timer-btn" data-action="ex-timer-set" data-sec="30">30s</button>
          <button type="button" class="secondary ex-timer-btn" data-action="ex-timer-set" data-sec="45">45s</button>
          <button type="button" class="secondary ex-timer-btn" data-action="ex-timer-set" data-sec="60">60s</button>
          <button type="button" class="secondary ex-timer-btn" data-action="ex-timer-set" data-sec="90">90s</button>
          <button type="button" class="secondary ex-timer-btn" data-action="ex-timer-set" data-sec="300">5m</button>
          <button type="button" class="secondary ex-timer-btn" data-action="ex-timer-set" data-sec="900">15m</button>
          <button type="button" class="secondary ex-timer-btn" data-action="ex-timer-set" data-sec="1200">20m</button>
          <button type="button" class="ghost ex-timer-btn" data-action="ex-timer-apply-to-form" data-ex-id="${escapeHtml(ex.id)}" title="Copia el tiempo actual al formulario de abajo">
            ✅ Usar tiempo en registro
          </button>
        </div>
      </div>
    `;
  }

  // ── Height Format & Auto-Calculable Body Composition Engine ──
  function formatHeightDisplay(heightIn, unit) {
    const inches = Number(heightIn) || 69;
    const cm = inches * 2.54;
    if (unit === 'cm') return `${cm.toFixed(1)} cm`;
    if (unit === 'm') return `${(cm / 100).toFixed(2)} m`;
    if (unit === 'in') return `${inches.toFixed(1)} in`;
    const ft = Math.floor(inches / 12);
    const remIn = Math.round(inches - ft * 12);
    return `${ft}' ${remIn}" (${cm.toFixed(0)} cm)`;
  }

  function computeProfileMetrics(prof) {
    const weightLb = Math.max(60, Number(prof.weightLb) || 175);
    const heightIn = Math.max(48, Number(prof.heightIn) || 69);
    const age = Math.max(14, Number(prof.age) || 30);
    const isMale = prof.sex !== 'mujer';

    const weightKg = weightLb / 2.20462262;
    const heightCm = heightIn * 2.54;
    const heightM = heightCm / 100;

    const bmi = weightKg / (heightM * heightM);
    let bmiCategory = 'Peso saludable';
    if (bmi < 18.5) bmiCategory = 'Bajo peso';
    else if (bmi >= 30) bmiCategory = 'Obesidad';
    else if (bmi >= 25) bmiCategory = 'Sobrepeso / Alta masa muscular';

    const sexFlag = isMale ? 1 : 0;
    const levelBonus = prof.level === 'avanzado' ? -2.2 : prof.level === 'intermedio' ? -1.0 : 0;
    const autoBmiBodyFat = Math.max(5, Math.min(52, (1.20 * bmi) + (0.23 * age) - (10.8 * sexFlag) - 5.4 + levelBonus));

    let navyBodyFat = null;
    if (prof.useTapeMeasurements) {
      const neck = Number(prof.neckIn) || 15;
      const waist = Number(prof.waistIn) || 34;
      const hip = Number(prof.hipIn) || 39;
      if (isMale && waist > neck + 1) {
        navyBodyFat = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(heightIn) + 36.76;
      } else if (!isMale && (waist + hip) > neck + 1) {
        navyBodyFat = 163.205 * Math.log10(waist + hip - neck) - 97.684 * Math.log10(heightIn) - 78.387;
      }
      if (navyBodyFat !== null && Number.isFinite(navyBodyFat)) {
        navyBodyFat = Math.max(5, Math.min(55, navyBodyFat));
      } else {
        navyBodyFat = null;
      }
    }

    let bodyFatPct = navyBodyFat !== null ? navyBodyFat : autoBmiBodyFat;
    bodyFatPct = Number(bodyFatPct.toFixed(1));

    const fatMassLb = Number(((weightLb * bodyFatPct) / 100).toFixed(1));
    const leanMassLb = Number((weightLb - fatMassLb).toFixed(1));
    const skeletalMuscleMassLb = Number((leanMassLb * (isMale ? 0.57 : 0.53)).toFixed(1));
    const skeletalMusclePct = Number(((skeletalMuscleMassLb / weightLb) * 100).toFixed(1));
    const ffmi = Number(((leanMassLb / 2.20462262) / (heightM * heightM)).toFixed(1));

    let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + (isMale ? 5 : -161);
    if ((prof.medicalTags || []).includes('hipotiroidismo')) bmr *= 0.93;
    const activityMult = prof.level === 'avanzado' ? 1.55 : prof.level === 'intermedio' ? 1.45 : 1.35;
    const tdee = Math.round(bmr * activityMult);

    let suggestedCalories = tdee;
    if (prof.goal === 'perdida_grasa') suggestedCalories = Math.max(1250, Math.round(tdee * 0.80));
    else if (prof.goal === 'hipertrofia') suggestedCalories = Math.round(tdee * 1.08);
    else suggestedCalories = Math.round(tdee * 0.92);

    let proteinPerLbLean = prof.goal === 'hipertrofia' ? 1.1 : 1.0;
    if ((prof.medicalTags || []).includes('renal_gota')) proteinPerLbLean = 0.75;
    const suggestedProtein = Math.round(leanMassLb * proteinPerLbLean);

    let suggestedNetCarbs = prof.goal === 'hipertrofia' ? 30 : 22;
    if ((prof.medicalTags || []).includes('diabetes')) suggestedNetCarbs = 18;

    return {
      bmi: Number(bmi.toFixed(1)),
      bmiCategory,
      bodyFatPct,
      fatMassLb,
      leanMassLb,
      skeletalMuscleMassLb,
      skeletalMusclePct,
      ffmi,
      bmr: Math.round(bmr),
      tdee,
      suggestedCalories,
      suggestedProtein,
      suggestedNetCarbs,
      methodLabel: navyBodyFat !== null ? 'Marina EE.UU. (Cinta métrica activa)' : 'Auto-Cálculo Biométrico (Sin cinta)'
    };
  }

  // ── Calorie Burn Calculator (METs + Weight + Intensity + Time/Sets) ──
  function estimateExerciseCalories(ex, opts = {}) {
    const prof = getActiveProfile();
    const weightKg = Math.max(35, (Number(prof.weightLb) || 175) / 2.20462262);
    const baseMet = Number(ex?.met) || 5.5;
    const rpe = Math.max(1, Math.min(10, Number(opts.rpe) || 8));
    const intensityMult = 0.65 + (rpe * 0.055);
    const mode = opts.mode || (ex?.trackingType === 'reps_weight' ? 'reps' : 'time');

    if (mode === 'time') {
      const mins = Math.max(0, Number(opts.durationMin) || 0);
      const secs = Math.max(0, Number(opts.durationSec) || 0);
      const sets = Math.max(1, Number(opts.sets) || 1);
      const totalMinutes = Math.max(0.25, (mins + secs / 60) * (ex?.trackingType === 'time_isometric' ? sets : 1));
      const kcal = (baseMet * intensityMult * 3.5 * weightKg / 200) * totalMinutes;
      return {
        kcal: Math.max(2, Math.round(kcal)),
        activeMinutes: Number(totalMinutes.toFixed(1)),
        effectiveMet: Number((baseMet * intensityMult).toFixed(1))
      };
    } else {
      const sets = Math.max(1, Number(opts.sets) || 3);
      const reps = Math.max(1, Number(opts.reps) || 10);
      const weightLb = Math.max(0, Number(opts.weightLb) || 0);
      const loadFactor = 1 + Math.min(0.35, weightLb / 400) + Math.min(0.2, reps / 60);
      const totalMinutes = sets * (0.45 + (reps * 0.05));
      const kcal = (baseMet * intensityMult * loadFactor * 3.5 * weightKg / 200) * totalMinutes;
      return {
        kcal: Math.max(3, Math.round(kcal)),
        activeMinutes: Number(totalMinutes.toFixed(1)),
        effectiveMet: Number((baseMet * intensityMult * loadFactor).toFixed(1))
      };
    }
  }

  function getThreeYouTubeLinks(ex) {
    const targetEs = ex.targetEs || ex.group || 'musculo';
    const baseName = ex.name.replace(/\s+(con barra|con mancuernas|en máquina|en polea|con peso corporal).*$/i, '').trim();
    return [
      {
        label: '▶ Video: Pesas / Mancuernas',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`como hacer ${baseName} ${targetEs} con pesas mancuernas barra tecnica`)}`
      },
      {
        label: '▶ Video: Máquina / Polea',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`como hacer ${baseName} ${targetEs} en maquina o polea gimnasio`)}`
      },
      {
        label: '▶ Video: Peso Corporal',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`ejercicio ${targetEs} ${baseName} en casa peso corporal calistenia`)}`
      }
    ];
  }

  function getSameMuscleVariants(ex, limit = 6) {
    if (!ex) return [];
    const prof = getActiveProfile();
    const injuredJoints = new Set(prof.injuryTags || []);

    const sameTargetPool = EXERCISES.filter((cand) => {
      if (cand.id === ex.id) return false;
      if (cand.target !== ex.target) return false;
      if (injuredJoints.size > 0 && (cand.jointStress || []).some((j) => injuredJoints.has(j))) return false;
      return true;
    });

    const byModality = new Map();
    for (const cand of sameTargetPool) {
      const m = cand.modality || 'peso_corporal';
      if (!byModality.has(m)) byModality.set(m, []);
      byModality.get(m).push(cand);
    }

    const picked = [];
    const modalityOrder = ['pesas_libres', 'maquinas', 'poleas', 'peso_corporal', 'bandas_funcional', 'cardio_ergometros'];
    let round = 0;
    while (picked.length < limit && round < 4) {
      for (const mod of modalityOrder) {
        const list = byModality.get(mod) || [];
        if (list[round] && !picked.some((p) => p.id === list[round].id)) {
          picked.push(list[round]);
          if (picked.length >= limit) break;
        }
      }
      round++;
    }
    return picked;
  }

  // ── Smart Routine Generator ───────────────────────────────
  function getAllowedEquipmentsForProfile(prof) {
    const tags = prof.equipmentTags || [];
    if (!tags.length) return null;
    const allowed = new Set();
    tags.forEach((tagId) => {
      const chip = EQUIPMENT_CHIPS.find((c) => c.id === tagId);
      if (chip) chip.matches.forEach((m) => allowed.add(m));
    });
    return allowed;
  }

  function scoreExerciseForProfile(ex, prof, activeModality) {
    let score = 50;
    const modPref = activeModality && activeModality !== 'todas' ? activeModality : prof.preferredModality;
    if (modPref && modPref !== 'todas') {
      if (ex.modality === modPref) score += 40;
      else score -= 25;
    }

    const allowedEquips = getAllowedEquipmentsForProfile(prof);
    if (allowedEquips && allowedEquips.size > 0) {
      if (allowedEquips.has(ex.equipment)) score += 20;
      else score -= 35;
    }

    if (prof.level === 'novato') {
      if (ex.difficultyLevel === 'novato') score += 25;
      else if (ex.difficultyLevel === 'intermedio') score += 5;
      else score -= 30;
    } else if (prof.level === 'intermedio') {
      if (ex.difficultyLevel === 'intermedio') score += 20;
      else if (ex.difficultyLevel === 'novato') score += 12;
      else score -= 5;
    } else if (prof.level === 'avanzado') {
      if (ex.difficultyLevel === 'avanzado' || ex.difficultyLevel === 'intermedio') score += 20;
    }

    if ((prof.injuryTags || []).some((j) => (ex.jointStress || []).includes(j))) {
      score -= 80;
    }

    if (ex.name.toLowerCase().includes('estiramiento')) score -= 20;
    return score;
  }

  function getSelectedGroupsForDate(date) {
    if (!state.selectedGroupsByDate[date] || !state.selectedGroupsByDate[date].length) {
      state.selectedGroupsByDate[date] = ['Pectoral', 'Hombros y cuello', 'Tríceps'];
    }
    return state.selectedGroupsByDate[date];
  }

  function getDailyRoutineExercises(date) {
    const prof = getActiveProfile();
    const groups = getSelectedGroupsForDate(date);
    const activeModality = prof.preferredModality || 'todas';
    const picked = [];
    const seenIds = new Set();

    const perGroupCount = groups.length <= 2 ? 3 : 2;
    groups.forEach((grp) => {
      const candidates = EXERCISES
        .filter((ex) => ex.group === grp)
        .map((ex) => ({ ex, score: scoreExerciseForProfile(ex, prof, activeModality) }))
        .sort((a, b) => b.score - a.score);

      const usedTargets = new Set();
      for (const item of candidates) {
        if (picked.filter((p) => p.origGroup === grp).length >= perGroupCount) break;
        if (!usedTargets.has(item.ex.target) || candidates.length <= perGroupCount) {
          usedTargets.add(item.ex.target);
          seenIds.add(item.ex.id);
          picked.push({ ...item.ex, origGroup: grp });
        }
      }
      for (const item of candidates) {
        if (picked.filter((p) => p.origGroup === grp).length >= perGroupCount) break;
        if (!seenIds.has(item.ex.id)) {
          seenIds.add(item.ex.id);
          picked.push({ ...item.ex, origGroup: grp });
        }
      }
    });

    const customIds = state.customRoutineIdsByDate[date] || [];
    customIds.forEach((id) => {
      const ex = EXERCISE_BY_ID.get(String(id));
      if (ex && !seenIds.has(ex.id)) {
        seenIds.add(ex.id);
        picked.push({ ...ex, isCustomAdded: true });
      }
    });

    return picked.map((ex) => {
      const swapKey = `${date}__${ex.id}`;
      const swappedId = state.swappedExerciseBySlot[swapKey];
      if (swappedId && EXERCISE_BY_ID.has(String(swappedId))) {
        const replacement = EXERCISE_BY_ID.get(String(swappedId));
        return { ...replacement, swappedFromId: ex.id, swappedFromName: ex.name };
      }
      return ex;
    });
  }

  // ── Sidebar & Header Synchronization ──────────────────────
  const VIEW_TITLES = {
    dashboard: { eyebrow: 'PANEL CENTRAL ORGANIZADO', title: '🏠 Dashboard General' },
    workout: { eyebrow: 'MODO GIMNASIO (ESTILO HEVY / JEFIT)', title: '🏋️ Entrenar Hoy & Cronómetro' },
    programs: { eyebrow: 'RUTINAS DE ENTRENADORES (BOOSTCAMP / WORKOUTGEN)', title: '🏆 Programas y Generador' },
    library: { eyebrow: 'ENCICLOPEDIA ILUSTRADA (ENTRENAMIENTOS.COM)', title: '📚 Biblioteca de 1,324 Ejercicios' },
    nutrition: { eyebrow: 'NUTRICIÓN CETOGÉNICA 100% TRANSCRITA', title: '🥑 Recetario Keto (131 Recetas)' },
    profile: { eyebrow: 'BIOMETRÍA AUTO-CALCULABLE Y SALUD', title: '👤 Mi Perfil, Altura, IMC & Historial' }
  };

  function syncWorkspaceChrome() {
    const ws = document.getElementById('appWorkspace');
    if (ws) ws.classList.toggle('sidebar-collapsed', !!state.sidebarCollapsed);

    const collapseBtn = document.getElementById('sidebarCollapseBtn');
    if (collapseBtn) collapseBtn.textContent = state.sidebarCollapsed ? '▶' : '◀';

    const date = state.selectedDate || todayIso();
    const routineCount = getDailyRoutineExercises(date).length;
    const todayBadge = document.getElementById('navTodayCount');
    if (todayBadge) todayBadge.textContent = String(routineCount);

    const exCount = document.getElementById('navExerciseCount');
    if (exCount) exCount.textContent = String(EXERCISES.length);
    const rxCount = document.getElementById('navRecipeCount');
    if (rxCount) rxCount.textContent = String(RECIPES.length);

    const meta = VIEW_TITLES[state.activeView] || VIEW_TITLES.dashboard;
    const eyeEl = document.getElementById('topbarEyebrow');
    const titleEl = document.getElementById('topbarTitle');
    if (eyeEl) eyeEl.textContent = meta.eyebrow;
    if (titleEl) titleEl.textContent = meta.title;

    const sel = document.getElementById('profileSelect');
    if (sel) {
      sel.innerHTML = state.profiles
        .map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === state.activeProfileId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
        .join('');
    }

    document.querySelectorAll('.sidebar-nav .nav-item').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.view === state.activeView);
    });
  }

  // ── 1. Render: Clean Modular Dashboard (4 Clear Panels, Zero Clutter) ──
  function renderDashboard() {
    const prof = getActiveProfile();
    const date = state.selectedDate || todayIso();
    const metrics = computeProfileMetrics(prof);
    const selectedGroups = getSelectedGroupsForDate(date);
    const routineExercises = getDailyRoutineExercises(date);

    const dayLogs = state.workoutLogs.filter((l) => l.profileId === prof.id && l.date === date);
    const totalKcalBurned = dayLogs.reduce((s, l) => s + (Number(l.caloriesBurned) || 0), 0);
    const totalVolumeLb = dayLogs.reduce((s, l) => s + ((Number(l.sets) || 0) * (Number(l.reps) || 0) * (Number(l.weightLb) || 0)), 0);
    const totalTimeMin = dayLogs.reduce((s, l) => s + (l.mode === 'time' ? (Number(l.durationMin) || 0) + Math.round((Number(l.durationSec) || 0) / 60) : 0), 0);

    const dayNutritionLogs = state.nutritionLogs.filter((l) => l.profileId === prof.id && l.date === date);
    const consumed = dayNutritionLogs.reduce(
      (acc, log) => {
        const rx = RECIPE_BY_ID.get(String(log.recipeId));
        if (!rx) return acc;
        const mult = Number(log.servings) || 1;
        acc.calories += (rx.macros?.calories || 0) * mult;
        acc.protein += (rx.macros?.protein || 0) * mult;
        acc.netCarbs += (rx.macros?.netCarbs || 0) * mult;
        return acc;
      },
      { calories: 0, protein: 0, netCarbs: 0 }
    );

    const breakfastRx = RECIPES.find((r) => r.mealType === 'desayuno') || RECIPES[0];
    const lunchRx = RECIPES.find((r) => r.mealType === 'comida') || RECIPES[22];
    const dinnerRx = RECIPES.find((r) => r.mealType === 'cena') || RECIPES[65];

    return `
      <div class="dashboard-grid">
        <!-- Panel 1: Entrenamiento de Hoy (Hevy / JEFIT Summary) -->
        <section class="dash-panel">
          <div>
            <div class="dash-panel-header">
              <div>
                <span class="eyebrow">🏋️ PANEL 1 · TU SESIÓN DE HOY</span>
                <h3>${selectedGroups.join(' + ')}</h3>
              </div>
              <input type="date" id="todayDateInput" value="${escapeHtml(date)}" style="width:auto;min-height:34px;padding:4px 10px;font-size:0.8rem;" />
            </div>
            <p class="muted" style="margin:6px 0 12px;font-size:0.86rem;">
              Modalidad: <strong>${escapeHtml(MODALITY_OPTIONS.find((m) => m.id === prof.preferredModality)?.label || '⚡ Todas')}</strong> ·
              Nivel: <strong>${escapeHtml(prof.level.toUpperCase())}</strong> ·
              <strong>${routineExercises.length} ejercicios</strong> listos con cronómetro integrado.
            </p>

            <div style="display:grid;gap:8px;margin-bottom:14px;">
              ${routineExercises.slice(0, 4).map((ex) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(57,255,20,0.14);">
                  <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                    <img src="${escapeHtml(ex.gif_url || ex.image)}" alt="" style="width:38px;height:38px;border-radius:8px;background:#fff;object-fit:contain;" />
                    <div style="min-width:0;">
                      <strong style="display:block;font-size:0.86rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(ex.name)}</strong>
                      <span class="muted" style="font-size:0.74rem;">${escapeHtml(ex.targetEs)} · ${escapeHtml(ex.modalityEs)}</span>
                    </div>
                  </div>
                  <span class="tag">${ex.trackingType === 'reps_weight' ? `${ex.defaultSets}×${ex.defaultReps}` : `⏱️ ${ex.defaultMinutes || 1}m`}</span>
                </div>
              `).join('')}
              ${routineExercises.length > 4 ? `<span class="muted" style="font-size:0.78rem;text-align:center;">+ ${routineExercises.length - 4} ejercicios más en tu sesión</span>` : ''}
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" style="flex:1;" data-action="switch-view" data-view="workout">
              ▶️ Iniciar Entrenamiento de Hoy (${routineExercises.length})
            </button>
            <button type="button" class="secondary" data-action="switch-view" data-view="programs">
              🏆 Cambiar Programa
            </button>
          </div>
        </section>

        <!-- Panel 2: Calorías Quemadas & Rendimiento -->
        <section class="dash-panel">
          <div>
            <div class="dash-panel-header">
              <div>
                <span class="eyebrow">🔥 PANEL 2 · QUEMA CALÓRICA Y PROGRESO</span>
                <h3>Actividad Registrada Hoy</h3>
              </div>
              <span class="tag">${dayLogs.length} registros</span>
            </div>
            <p class="muted" style="margin:6px 0 14px;font-size:0.86rem;">
              Cada serie por repeticiones o sesión por tiempo (caminadora, bici, HIIT) calcula automáticamente tus calorías quemadas según tus <strong>${prof.weightLb} lb</strong>.
            </p>

            <div class="dash-stat-strip">
              <div class="dash-stat-box">
                <span>🔥 Calorías Hoy</span>
                <strong>${totalKcalBurned} kcal</strong>
                <small>Quemadas en ejercicio</small>
              </div>
              <div class="dash-stat-box">
                <span>⏱️ Tiempo Cardio</span>
                <strong>${totalTimeMin} min</strong>
                <small>Caminadora / Bici / HIIT</small>
              </div>
              <div class="dash-stat-box">
                <span>🏋️ Volumen Fuerza</span>
                <strong>${totalVolumeLb.toLocaleString()} lb</strong>
                <small>Series × Reps × Peso</small>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="secondary" style="flex:1;" data-action="switch-view" data-view="workout">
              ⏱️ Registrar Ejercicio o Cardio
            </button>
            <button type="button" class="ghost" data-action="open-profile-tab" data-subtab="historial">
              📈 Ver Historial Completo
            </button>
          </div>
        </section>

        <!-- Panel 3: Nutrición Keto del Día (Con Almuerzos Incluidos) -->
        <section class="dash-panel">
          <div>
            <div class="dash-panel-header">
              <div>
                <span class="eyebrow">🥑 PANEL 3 · NUTRICIÓN KETO DEL DÍA</span>
                <h3>Macros &amp; Menú Sugerido</h3>
              </div>
              <span class="tag coral">${Math.round(consumed.netCarbs)} / ${prof.netCarbTarget || metrics.suggestedNetCarbs}g Carbs Netos</span>
            </div>

            <div class="dash-stat-strip" style="margin:10px 0 14px;">
              <div class="dash-stat-box">
                <span>Calorías Keto</span>
                <strong>${Math.round(consumed.calories)}</strong>
                <small>Meta: ${prof.caloriesTarget || metrics.suggestedCalories} kcal</small>
              </div>
              <div class="dash-stat-box">
                <span>Proteína</span>
                <strong>${Math.round(consumed.protein)}g</strong>
                <small>Meta: ${prof.proteinTarget || metrics.suggestedProtein}g</small>
              </div>
              <div class="dash-stat-box">
                <span>Carbos Netos</span>
                <strong>${Math.round(consumed.netCarbs)}g</strong>
                <small>Tope: ${prof.netCarbTarget || metrics.suggestedNetCarbs}g</small>
              </div>
            </div>

            <div style="display:grid;gap:8px;">
              ${[
                { label: '🌅 Desayuno', rx: breakfastRx },
                { label: '☀️ Almuerzo', rx: lunchRx },
                { label: '🌙 Cena', rx: dinnerRx }
              ].filter((x) => x.rx).map(({ label, rx }) => `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(57,255,20,0.14);">
                  <div style="min-width:0;">
                    <span class="tag" style="font-size:0.68rem;padding:2px 7px;">${label}</span>
                    <strong style="font-size:0.85rem;margin-left:6px;">${escapeHtml(rx.name)}</strong>
                    <span class="muted" style="font-size:0.75rem;display:block;margin-top:2px;">
                      🔥 ${rx.macros?.calories || 0} kcal · 🥑 ${rx.macros?.netCarbs || 0}g carbs netos
                    </span>
                  </div>
                  <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button type="button" class="secondary" style="min-height:30px;padding:4px 8px;font-size:0.74rem;" data-action="open-recipe-modal" data-recipe-id="${escapeHtml(rx.id)}">📖 Receta</button>
                    <button type="button" style="min-height:30px;padding:4px 8px;font-size:0.74rem;" data-action="quick-log-recipe" data-recipe-id="${escapeHtml(rx.id)}">+ Hoy</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <button type="button" class="secondary" style="width:100%;" data-action="switch-view" data-view="nutrition">
            🥑 Explorar las 131 Recetas Keto (Desayunos, Almuerzos, Cenas y Postres)
          </button>
        </section>

        <!-- Panel 4: Biometría Auto-Calculada & Escudo de Salud -->
        <section class="dash-panel">
          <div>
            <div class="dash-panel-header">
              <div>
                <span class="eyebrow">🧬 PANEL 4 · BIOMETRÍA &amp; ADAPTACIÓN</span>
                <h3>${escapeHtml(prof.name)} (${formatHeightDisplay(prof.heightIn, prof.heightUnit)})</h3>
              </div>
              <span class="tag">✨ Auto-calculado</span>
            </div>

            <div class="dash-stat-strip" style="margin:10px 0 14px;">
              <div class="dash-stat-box">
                <span>% Grasa Corporal</span>
                <strong>${metrics.bodyFatPct}%</strong>
                <small>${metrics.fatMassLb} lb grasa</small>
              </div>
              <div class="dash-stat-box">
                <span>Masa Magra</span>
                <strong>${metrics.leanMassLb} lb</strong>
                <small>~${metrics.skeletalMuscleMassLb} lb músculo</small>
              </div>
              <div class="dash-stat-box">
                <span>IMC / Nivel</span>
                <strong>${metrics.bmi}</strong>
                <small>${escapeHtml(prof.level.toUpperCase())}</small>
              </div>
            </div>

            <div style="padding:10px 12px;border-radius:10px;background:rgba(57,255,20,0.06);border:1px solid rgba(57,255,20,0.2);font-size:0.8rem;color:#d9ecdc;line-height:1.45;">
              <div><strong>🏋️ Equipos activos:</strong> ${prof.equipmentTags.length} grupos seleccionados</div>
              <div><strong>🩹 Protección articular:</strong> ${prof.injuryTags.length ? prof.injuryTags.join(', ') : 'Ninguna lesión activa'}</div>
              <div><strong>🩺 Condiciones médicas:</strong> ${prof.medicalTags.length ? prof.medicalTags.join(', ') : 'Ninguna condición activa'}</div>
            </div>
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button type="button" class="secondary" style="flex:1;" data-action="open-profile-tab" data-subtab="biometria">
              📏 Altura / Peso
            </button>
            <button type="button" class="secondary" style="flex:1;" data-action="open-profile-tab" data-subtab="salud">
              🛡️ Equipo y Salud
            </button>
            <button type="button" class="secondary" style="flex:1;border-color:rgba(57,255,20,0.45);color:var(--green);" data-action="export-profile-json">
              ⬇️ Descargar .JSON
            </button>
            <button type="button" class="ghost" style="flex:1;" data-action="trigger-import-json">
              ⬆️ Cargar .JSON
            </button>
          </div>
        </section>
      </div>
    `;
  }

  // ── 2. Render: Focused Workout View (Hevy / JEFIT Compact Accordion + Per-Exercise Timer) ──
  function renderWorkout() {
    const prof = getActiveProfile();
    const date = state.selectedDate || todayIso();
    const selectedGroups = getSelectedGroupsForDate(date);
    const routineExercises = getDailyRoutineExercises(date);

    if (!state.openWorkoutExerciseId && routineExercises.length > 0) {
      state.openWorkoutExerciseId = routineExercises[0].id;
    }

    return `
      <div class="view-header">
        <div>
          <span class="eyebrow">🏋️ MODO ENTRENAMIENTO ENFOCADO (ESTILO HEVY / JEFIT)</span>
          <h2>Sesión de Hoy: ${escapeHtml(selectedGroups.join(' + '))}</h2>
          <p>
            Haz clic en cualquier ejercicio de tu lista para desplegar su <strong>Cronómetro integrado</strong>, sus <strong>3 videos de YouTube</strong>, sus <strong>variantes del mismo músculo</strong> y registrar tus series o tiempo sin desorden visual.
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="secondary" data-action="switch-view" data-view="programs">🏆 Cambiar Rutina / Modalidad</button>
          <button type="button" class="secondary" data-action="switch-view" data-view="library">+ Agregar Ejercicio</button>
        </div>
      </div>

      <!-- Quick Modality Bar right above the workout list -->
      <div class="library-quick-chips" style="margin:0 0 16px;padding:10px 14px;border-radius:14px;border:1px solid var(--line);background:rgba(10,16,12,0.9);">
        <span class="muted" style="font-size:0.78rem;font-weight:800;margin-right:4px;">Entrenar hoy con:</span>
        ${MODALITY_OPTIONS.map((m) => `
          <button type="button" class="quick-chip ${(prof.preferredModality || 'todas') === m.id ? 'is-active' : ''}" data-action="select-preferred-modality" data-modality="${escapeHtml(m.id)}">
            ${escapeHtml(m.short)}
          </button>
        `).join('')}
      </div>

      <div class="hevy-workout-list">
        ${routineExercises.map((ex, idx) => {
          const isOpen = String(state.openWorkoutExerciseId) === String(ex.id);
          const dayLogs = state.workoutLogs.filter((l) => l.profileId === prof.id && l.date === date && String(l.exerciseId) === String(ex.id));
          const defaultMode = ex.trackingType === 'reps_weight' ? 'reps' : 'time';
          const activeMode = state.trackingModeOverride[ex.id] || defaultMode;
          const activeBranch = state.cardBranchTabByEx[ex.id] || 'log';
          const ytLinks = getThreeYouTubeLinks(ex);
          const variants = getSameMuscleVariants(ex, 6);

          const initialCal = estimateExerciseCalories(ex, {
            mode: activeMode,
            sets: ex.defaultSets || 3,
            reps: ex.defaultReps || 10,
            weightLb: ex.defaultWeightLb ?? 45,
            durationMin: ex.defaultMinutes ?? 15,
            durationSec: ex.defaultSeconds ?? 0,
            rpe: 8
          });

          return `
            <article class="hevy-exercise-row ${isOpen ? 'is-open' : ''}" id="workout-row-${escapeHtml(ex.id)}">
              <!-- Compact Summary Header (Always visible, super clean!) -->
              <div class="hevy-row-summary" data-action="toggle-workout-accordion" data-ex-id="${escapeHtml(ex.id)}">
                <div class="hevy-row-left">
                  <img class="hevy-thumb" src="${escapeHtml(ex.gif_url || ex.image)}" alt="${escapeHtml(ex.name)}" loading="lazy" />
                  <div class="hevy-row-title">
                    <div class="tag-row" style="margin:0 0 4px;">
                      <span class="tag">#${idx + 1} · ${escapeHtml(ex.targetEs)}</span>
                      <span class="tag neutral">${escapeHtml(ex.modalityEs)}</span>
                      ${ex.trackingType !== 'reps_weight' ? `<span class="tag coral">⏱️ Por Tiempo</span>` : ''}
                    </div>
                    <h3>${escapeHtml(ex.name)}</h3>
                    <span class="muted" style="font-size:0.78rem;">
                      ${escapeHtml(ex.equipmentEs)} · Sugerido: ${escapeHtml(ex.prescription.sets)} × ${escapeHtml(ex.prescription.reps)}
                    </span>
                  </div>
                </div>
                <div class="hevy-row-right">
                  ${dayLogs.length > 0
                    ? `<span class="tag" style="background:var(--green);color:#031005;">✓ ${dayLogs.length} reg. (${dayLogs.reduce((s, l) => s + (l.caloriesBurned || 0), 0)} kcal)</span>`
                    : `<span class="tag neutral">Pendiente</span>`}
                  <button type="button" class="secondary" style="min-height:34px;padding:6px 12px;font-size:0.78rem;" data-action="open-exercise-modal" data-ex-id="${escapeHtml(ex.id)}">
                    🔍 Pantalla Completa
                  </button>
                  <span style="color:var(--green);font-weight:900;font-size:1rem;">${isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              ${isOpen ? `
                <div class="hevy-expanded-body">
                  <!-- Built-In Exercise Timer right inside the opened exercise! -->
                  ${renderEmbeddedExerciseTimer(ex)}

                  <div class="exercise-card" style="gap:18px;">
                    <div class="exercise-media-pane" style="border-radius:14px;border:1px solid var(--line);">
                      <div class="exercise-visual-frame" data-action="open-exercise-modal" data-ex-id="${escapeHtml(ex.id)}" style="cursor:pointer;">
                        <img src="${escapeHtml(ex.gif_url || ex.image)}" alt="${escapeHtml(ex.name)}" />
                        <div class="media-badge-overlay">
                          <span class="id-pill">#${escapeHtml(ex.id)}</span>
                          <span class="gif-status-pill">${activeMode === 'time' ? '⏱️ TIEMPO' : 'GIF HD'}</span>
                        </div>
                      </div>

                      <div style="margin-top:10px;">
                        <span class="muted" style="display:block;font-size:0.7rem;font-weight:800;text-transform:uppercase;margin-bottom:6px;">
                          📺 3 Opciones de Video en YouTube (${escapeHtml(ex.targetEs)}):
                        </span>
                        <div class="yt-options-row" style="grid-template-columns:1fr;gap:6px;margin:0;">
                          ${ytLinks.map((yt) => `
                            <a class="yt-option-link" href="${escapeHtml(yt.url)}" target="_blank" rel="noopener noreferrer">
                              ${escapeHtml(yt.label)}
                            </a>
                          `).join('')}
                        </div>
                      </div>
                    </div>

                    <div>
                      <div class="card-branch-tabs" style="margin-top:0;">
                        <button type="button" class="card-branch-tab ${activeBranch === 'log' ? 'is-active' : ''}" data-action="set-card-branch" data-ex-id="${escapeHtml(ex.id)}" data-branch="log">
                          ${activeMode === 'time' ? '⏱️ Registrar Tiempo y Calorías' : '📝 Registrar Serie y Calorías'}
                        </button>
                        <button type="button" class="card-branch-tab ${activeBranch === 'variants' ? 'is-active' : ''}" data-action="set-card-branch" data-ex-id="${escapeHtml(ex.id)}" data-branch="variants">
                          🔄 Variantes del Mismo Músculo (${variants.length})
                        </button>
                        <button type="button" class="card-branch-tab ${activeBranch === 'tech' ? 'is-active' : ''}" data-action="set-card-branch" data-ex-id="${escapeHtml(ex.id)}" data-branch="tech">
                          📋 Instrucciones Paso a Paso
                        </button>
                      </div>

                      ${activeBranch === 'log' ? `
                        <div class="tracking-mode-bar">
                          <span class="muted" style="font-size:0.8rem;">
                            Selecciona cómo medir este ejercicio:
                          </span>
                          <div class="tracking-mode-switch">
                            <button type="button" class="tracking-mode-btn ${activeMode === 'time' ? 'is-active' : ''}" data-action="set-tracking-mode" data-ex-id="${escapeHtml(ex.id)}" data-mode="time">
                              ⏱️ Por Tiempo / Cardio
                            </button>
                            <button type="button" class="tracking-mode-btn ${activeMode === 'reps' ? 'is-active' : ''}" data-action="set-tracking-mode" data-ex-id="${escapeHtml(ex.id)}" data-mode="reps">
                              🏋️ Por Reps y Peso
                            </button>
                          </div>
                        </div>

                        <form class="workout-log-form" id="form-ex-${escapeHtml(ex.id)}" data-ex-id="${escapeHtml(ex.id)}" data-mode="${activeMode}">
                          ${activeMode === 'time' ? `
                            <div class="form-grid">
                              <div class="field">
                                <label>Duración (Minutos)</label>
                                <input type="number" name="durationMin" min="0" max="300" step="1" value="${ex.defaultMinutes ?? 15}" data-calc-cal="1" />
                              </div>
                              <div class="field">
                                <label>Segundos extra (s)</label>
                                <input type="number" name="durationSec" min="0" max="59" step="1" value="${ex.defaultSeconds ?? 0}" data-calc-cal="1" />
                              </div>
                              <div class="field">
                                <label>Bloques / Series</label>
                                <input type="number" name="sets" min="1" max="20" value="${ex.defaultSets || 1}" data-calc-cal="1" />
                              </div>
                              <div class="field">
                                <label>Intensidad RPE (1-10)</label>
                                <input type="number" name="rpe" min="1" max="10" value="8" data-calc-cal="1" />
                              </div>
                              <div class="field full">
                                <label>Notas (velocidad, inclinación, resistencia...)</label>
                                <input type="text" name="notes" placeholder="Ej. Caminadora 6 km/h o Bicicleta nivel 8" />
                              </div>
                            </div>
                          ` : `
                            <div class="form-grid">
                              <div class="field">
                                <label>Series</label>
                                <input type="number" name="sets" min="1" max="20" value="${ex.defaultSets || 3}" data-calc-cal="1" />
                              </div>
                              <div class="field">
                                <label>Repeticiones</label>
                                <input type="number" name="reps" min="1" max="100" value="${ex.defaultReps || 10}" data-calc-cal="1" />
                              </div>
                              <div class="field">
                                <label>Peso (lb) ${ex.equipment === 'body weight' ? '(0 = Corporal)' : ''}</label>
                                <input type="number" name="weightLb" min="0" max="1500" step="2.5" value="${ex.defaultWeightLb ?? 45}" data-calc-cal="1" />
                              </div>
                              <div class="field">
                                <label>RPE (1-10)</label>
                                <input type="number" name="rpe" min="1" max="10" value="8" data-calc-cal="1" />
                              </div>
                              <div class="field full">
                                <label>Notas de la serie</label>
                                <input type="text" name="notes" placeholder="Ej. Buen control técnico..." />
                              </div>
                            </div>
                          `}

                          <div class="calorie-burn-banner">
                            <div>
                              <span class="eyebrow" style="font-size:0.68rem;">🔥 CALORÍAS ESTIMADAS (${prof.weightLb} LB)</span>
                              <div style="font-size:0.86rem;color:#d9ecdc;">
                                Quemarás aprox.: <strong class="live-cal-value">~${initialCal.kcal} kcal</strong>
                                <span class="muted live-cal-meta">(${initialCal.activeMinutes} min activos · ${initialCal.effectiveMet} METs)</span>
                              </div>
                            </div>
                            <button type="submit">
                              ✓ Guardar Registro (+Iniciar Descanso)
                            </button>
                          </div>
                        </form>

                        ${dayLogs.length ? `
                          <div class="logged-sets-box">
                            <h4>Series / Tiempos registrados hoy (${dayLogs.length})</h4>
                            ${dayLogs.map((l) => `
                              <div class="logged-set-item">
                                <span>
                                  ${l.mode === 'time'
                                    ? `⏱️ <strong>${l.durationMin}m ${l.durationSec || 0}s</strong> (${l.sets || 1} bloq) · RPE ${l.rpe}`
                                    : `🏋️ <strong>${l.sets} × ${l.reps} reps</strong> @ ${l.weightLb} lb · RPE ${l.rpe}`}
                                  · <strong style="color:var(--green);">🔥 ${l.caloriesBurned || 0} kcal</strong>
                                </span>
                                <button type="button" class="ghost" style="min-height:24px;padding:2px 7px;font-size:0.72rem;" data-action="delete-workout-log" data-log-id="${escapeHtml(l.id)}">✕</button>
                              </div>
                            `).join('')}
                          </div>
                        ` : ''}
                      ` : ''}

                      ${activeBranch === 'variants' ? `
                        <div class="variant-switcher-box">
                          <strong style="color:var(--green);font-size:0.88rem;">🎯 Alternativas para el Mismo Músculo: ${escapeHtml(ex.targetEs)}</strong>
                          <p class="muted" style="margin:4px 0 8px;font-size:0.78rem;">
                            Elige otra modalidad (pesas, máquina, polea o peso corporal) manteniendo exactamente el mismo músculo objetivo:
                          </p>
                          <div class="variant-grid">
                            ${variants.map((v) => `
                              <div class="variant-mini-card" data-action="swap-exercise-variant" data-orig-id="${escapeHtml(ex.swappedFromId || ex.id)}" data-new-id="${escapeHtml(v.id)}">
                                <img src="${escapeHtml(v.gif_url || v.image)}" alt="${escapeHtml(v.name)}" />
                                <div class="variant-mini-info">
                                  <strong>${escapeHtml(v.name)}</strong>
                                  <small>${escapeHtml(v.modalityEs)}</small>
                                  <span class="muted" style="font-size:0.7rem;">🔄 Usar hoy</span>
                                </div>
                              </div>
                            `).join('')}
                          </div>
                        </div>
                      ` : ''}

                      ${activeBranch === 'tech' ? `
                        <div class="detail-block" style="border-top:0;padding-top:4px;">
                          <h4>Técnica Paso a Paso</h4>
                          <ol>${(ex.instruction_steps?.es || []).map((st) => `<li>${escapeHtml(st)}</li>`).join('')}</ol>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                </div>
              ` : ''}
            </article>
          `;
        }).join('')}
      </div>
    `;
  }

  // ── 3. Render: Programs & Smart Routine Generator (Boostcamp + WorkoutGen) ──
  function renderPrograms() {
    const prof = getActiveProfile();
    const date = state.selectedDate || todayIso();
    const selectedGroups = getSelectedGroupsForDate(date);

    return `
      <div class="view-header">
        <div>
          <span class="eyebrow">🏆 PROGRAMAS DE ENTRENADORES Y GENERADOR (ESTILO BOOSTCAMP &amp; WORKOUTGEN)</span>
          <h2>Elige un Programa Estructurado o Genera tu Tabla a Medida</h2>
          <p>Selecciona un programa prediseñado con un clic o personaliza tus grupos musculares y modalidad preferida.</p>
        </div>
      </div>

      <section class="panel" style="margin-bottom:20px;">
        <span class="eyebrow">OPCIÓN A · PROGRAMAS LISTOS PARA SEGUIR (ESTILO BOOSTCAMP)</span>
        <h3 style="margin:4px 0 14px;">Programas Estructurados por Objetivo y Modalidad</h3>
        <div class="program-grid">
          ${COACH_PROGRAMS.map((prog) => `
            <article class="program-card">
              <div>
                <div class="tag-row" style="margin-top:0;">
                  <span class="tag">${escapeHtml(prog.coach)}</span>
                  <span class="tag neutral">${escapeHtml(prog.level)}</span>
                </div>
                <h3 style="margin:6px 0;font-size:1.1rem;">${escapeHtml(prog.title)}</h3>
                <p class="muted" style="margin:0 0 10px;font-size:0.83rem;line-height:1.45;">${escapeHtml(prog.desc)}</p>
                <div class="tag-row">
                  ${prog.groups.map((g) => `<span class="tag coral">${escapeHtml(g)}</span>`).join('')}
                </div>
              </div>
              <button type="button" data-action="activate-coach-program" data-prog-id="${escapeHtml(prog.id)}">
                ⚡ Activar este Programa para Hoy e Ir a Entrenar
              </button>
            </article>
          `).join('')}
        </div>
      </section>

      <section class="panel">
        <span class="eyebrow">OPCIÓN B · GENERADOR PERSONALIZADO (ESTILO WORKOUTGEN)</span>
        <h3 style="margin:4px 0 12px;">1. Elige con qué Modalidad de Esfuerzo quieres entrenar</h3>
        <div class="modality-grid" style="margin-bottom:18px;">
          ${MODALITY_OPTIONS.map((mod) => {
            const count = mod.id === 'todas' ? EXERCISES.length : EXERCISES.filter((e) => e.modality === mod.id).length;
            const isSel = (prof.preferredModality || 'todas') === mod.id;
            return `
              <button type="button" class="modality-card ${isSel ? 'is-selected' : ''}" data-action="select-preferred-modality" data-modality="${escapeHtml(mod.id)}">
                <strong>${escapeHtml(mod.label)}</strong>
                <span>${escapeHtml(mod.desc)}</span>
                <span class="tag neutral" style="align-self:flex-start;margin-top:4px;">${count} ejercicios</span>
              </button>
            `;
          }).join('')}
        </div>

        <h3 style="margin:16px 0 10px;">2. Selecciona los Músculos para tu Sesión (${selectedGroups.length} activos)</h3>
        <div class="group-chip-grid">
          ${ROUTINE_GROUPS.map((grp) => {
            const count = EXERCISES.filter((e) => e.group === grp).length;
            const isSel = selectedGroups.includes(grp);
            return `
              <button type="button" class="group-chip ${isSel ? 'is-selected' : ''}" data-action="toggle-day-group" data-group="${escapeHtml(grp)}">
                <div class="group-chip-top">
                  <span class="group-chip-mark">${isSel ? '✓ ACTIVO' : 'MÚSCULO'}</span>
                  <span class="group-chip-count">${count} ej.</span>
                </div>
                <strong>${escapeHtml(grp)}</strong>
              </button>
            `;
          }).join('')}
        </div>

        <div class="actions" style="margin-top:18px;">
          <button type="button" data-action="switch-view" data-view="workout">
            ▶️ Ver Mi Rutina Generada y Empezar a Entrenar
          </button>
        </div>
      </section>
    `;
  }

  // ── 4. Render: 1,324 Exercise Library (Entrenamientos.com Style) ──
  function renderLibrary() {
    const f = state.libraryFilter;
    const q = (f.search || '').trim().toLowerCase();

    const filtered = EXERCISES.filter((ex) => {
      if (f.onlyFavorites && !state.favorites.includes(ex.id)) return false;
      if (f.group !== 'Todos' && ex.group !== f.group) return false;
      if (f.modality !== 'todas' && ex.modality !== f.modality) return false;
      if (f.level !== 'todos' && ex.difficultyLevel !== f.level) return false;
      if (f.trackingType !== 'todos' && ex.trackingType !== f.trackingType) return false;
      if (q) {
        const hay = `${ex.id} ${ex.name} ${ex.englishName} ${ex.targetEs} ${ex.equipmentEs} ${ex.group}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const visible = filtered.slice(0, f.limit || 24);

    return `
      <section class="library-console">
        <div class="library-search-row">
          <div class="field">
            <label>Buscar por nombre, músculo o #ID</label>
            <div class="search-input-wrap">
              <span class="search-input-icon">🔍</span>
              <input type="text" id="libSearchInput" value="${escapeHtml(f.search)}" placeholder="Ej. Press de banca, Pectorales, Caminadora, #0684..." />
            </div>
          </div>
          <div class="field">
            <label>Grupo Muscular</label>
            <select id="libGroupSelect">
              <option value="Todos">Todos los grupos (${EXERCISES.length})</option>
              ${ROUTINE_GROUPS.map((g) => `<option value="${escapeHtml(g)}" ${f.group === g ? 'selected' : ''}>${escapeHtml(g)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Modalidad (Máquina / Pesas / Esfuerzo)</label>
            <select id="libModalitySelect">
              ${MODALITY_OPTIONS.map((m) => `<option value="${escapeHtml(m.id)}" ${f.modality === m.id ? 'selected' : ''}>${escapeHtml(m.label)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Nivel</label>
            <select id="libLevelSelect">
              <option value="todos" ${f.level === 'todos' ? 'selected' : ''}>Todos los niveles</option>
              <option value="novato" ${f.level === 'novato' ? 'selected' : ''}>Principiante (Novato)</option>
              <option value="intermedio" ${f.level === 'intermedio' ? 'selected' : ''}>Intermedio</option>
              <option value="avanzado" ${f.level === 'avanzado' ? 'selected' : ''}>Avanzado</option>
            </select>
          </div>
        </div>

        <div class="library-quick-chips">
          ${MODALITY_OPTIONS.map((m) => `
            <button type="button" class="quick-chip ${f.modality === m.id ? 'is-active' : ''}" data-action="set-lib-modality" data-modality="${escapeHtml(m.id)}">
              ${escapeHtml(m.label)}
            </button>
          `).join('')}
          <button type="button" class="quick-chip ${f.trackingType === 'time_cardio' ? 'is-active' : ''}" data-action="toggle-lib-time-cardio">
            ⏱️ Solo Por Tiempo / Cardio
          </button>
          <button type="button" class="quick-chip ${f.onlyFavorites ? 'is-active' : ''}" data-action="toggle-lib-favs">
            ★ Favoritos (${state.favorites.length})
          </button>
        </div>

        <div class="library-status-bar">
          <span class="muted">Mostrando <strong>${visible.length}</strong> de <strong>${filtered.length}</strong> ejercicios</span>
          <button type="button" class="ghost" data-action="reset-lib-filters">Limpiar filtros</button>
        </div>
      </section>

      <div class="catalog-grid">
        ${visible.map((ex) => {
          const isFav = state.favorites.includes(ex.id);
          return `
            <article class="catalog-card">
              <div>
                <div class="catalog-media" data-action="open-exercise-modal" data-ex-id="${escapeHtml(ex.id)}">
                  <img src="${escapeHtml(ex.gif_url || ex.image)}" alt="${escapeHtml(ex.name)}" loading="lazy" />
                  <div class="catalog-top-badges">
                    <span class="id-pill">#${escapeHtml(ex.id)}</span>
                    <button type="button" class="fav-btn ${isFav ? 'is-fav' : ''}" data-action="toggle-favorite" data-ex-id="${escapeHtml(ex.id)}" title="Favorito">★</button>
                  </div>
                  <span class="catalog-gif-hint">${ex.trackingType === 'reps_weight' ? `🔥 ${ex.met} METs` : `⏱️ TIEMPO · ${ex.met} METs`}</span>
                </div>
                <div class="catalog-body">
                  <div>
                    <div class="tag-row" style="margin-top:0;">
                      <span class="tag">${escapeHtml(ex.targetEs)}</span>
                      <span class="tag neutral">${escapeHtml(ex.modalityEs)}</span>
                    </div>
                    <h3 class="catalog-title" data-action="open-exercise-modal" data-ex-id="${escapeHtml(ex.id)}">${escapeHtml(ex.name)}</h3>
                    <p class="catalog-subtitle">${escapeHtml(ex.equipmentEs)} · ${escapeHtml(ex.level)}</p>
                  </div>
                  <div class="catalog-actions">
                    <button type="button" class="secondary" data-action="open-exercise-modal" data-ex-id="${escapeHtml(ex.id)}">⏱️ Abrir &amp; Timer</button>
                    <button type="button" data-action="add-to-today-routine" data-ex-id="${escapeHtml(ex.id)}">+ A Rutina Hoy</button>
                  </div>
                </div>
              </div>
            </article>
          `;
        }).join('')}
      </div>

      ${visible.length < filtered.length ? `
        <div class="load-more-wrap">
          <button type="button" data-action="load-more-exercises">
            Mostrar más ejercicios (${filtered.length - visible.length} restantes)
          </button>
        </div>
      ` : ''}
    `;
  }

  // ── 5. Render: 131 Transcribed Keto Recipes (Fixed Almuerzos + Clean Cards + Step Reader Modal) ──
  function renderNutrition() {
    const nf = state.nutritionFilter;
    const q = (nf.search || '').trim().toLowerCase();
    const activeCat = MEAL_CATEGORIES.find((c) => c.id === nf.mealType) || MEAL_CATEGORIES[0];

    const filtered = RECIPES.filter((rx) => {
      if (!activeCat.match(rx)) return false;
      if (nf.maxNetCarbs < 99 && (rx.macros?.netCarbs || 0) > nf.maxNetCarbs) return false;
      if (q) {
        const hay = `${rx.name} ${rx.description} ${(rx.ingredients || []).join(' ')} ${rx.chapter || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const visible = filtered.slice(0, nf.limit || 24);

    return `
      <section class="library-console">
        <div class="library-search-row" style="grid-template-columns:minmax(0,1.4fr) repeat(2,minmax(200px,0.6fr));">
          <div class="field">
            <label>Buscar por ingrediente o platillo</label>
            <div class="search-input-wrap">
              <span class="search-input-icon">🥑</span>
              <input type="text" id="ketoSearchInput" value="${escapeHtml(nf.search)}" placeholder="Ej. Ensalada, Sopa, Salmón, Pollo, Aguacate, Huevos..." />
            </div>
          </div>
          <div class="field">
            <label>Tiempo de comida / Categoría</label>
            <select id="ketoMealSelect">
              ${MEAL_CATEGORIES.map((cat) => {
                const cnt = RECIPES.filter(cat.match).length;
                return `<option value="${escapeHtml(cat.id)}" ${nf.mealType === cat.id ? 'selected' : ''}>${escapeHtml(cat.label)} (${cnt})</option>`;
              }).join('')}
            </select>
          </div>
          <div class="field">
            <label>Máximo Carbos Netos por porción</label>
            <select id="ketoCarbSelect">
              <option value="99" ${nf.maxNetCarbs === 99 ? 'selected' : ''}>Sin filtro (${RECIPES.length})</option>
              <option value="3" ${nf.maxNetCarbs === 3 ? 'selected' : ''}>Ultra Keto (≤ 3g netos)</option>
              <option value="5" ${nf.maxNetCarbs === 5 ? 'selected' : ''}>Estricto (≤ 5g netos)</option>
              <option value="8" ${nf.maxNetCarbs === 8 ? 'selected' : ''}>Moderado (≤ 8g netos)</option>
            </select>
          </div>
        </div>

        <!-- Quick Category Chips with Exact Counts -->
        <div class="library-quick-chips">
          ${MEAL_CATEGORIES.map((cat) => {
            const cnt = RECIPES.filter(cat.match).length;
            return `
              <button type="button" class="quick-chip ${nf.mealType === cat.id ? 'is-active' : ''}" data-action="set-keto-meal-chip" data-meal="${escapeHtml(cat.id)}">
                ${escapeHtml(cat.label)} (${cnt})
              </button>
            `;
          }).join('')}
        </div>

        <div class="library-status-bar">
          <span class="muted">Mostrando <strong>${visible.length}</strong> de <strong>${filtered.length}</strong> recetas transcritas en esta categoría</span>
          ${(nf.search || nf.mealType !== 'todos' || nf.maxNetCarbs < 99) ? `
            <button type="button" class="ghost" data-action="reset-keto-filters">Ver todas las 131 recetas</button>
          ` : ''}
        </div>
      </section>

      <!-- Organized, Clean 2-Column Recipe Grid (No Visual Overload!) -->
      <div class="program-grid" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr));">
        ${visible.map((rx) => `
          <article class="recipe-transcribed-card" id="recipe-card-${escapeHtml(rx.id)}" style="justify-content:space-between;">
            <div>
              <div class="tag-row" style="margin-top:0;">
                <span class="tag">${escapeHtml(getMealBadgeLabel(rx.mealType))}</span>
                <span class="tag coral">🍽️ ${escapeHtml(rx.servingsLabel || '2 porciones')}</span>
                <span class="tag neutral">⏱️ ${escapeHtml(rx.prepTimeLabel || (rx.timeMinutes + ' min'))}</span>
              </div>
              <h3 style="margin:6px 0;font-size:1.15rem;">${escapeHtml(rx.name)}</h3>
              <p class="muted" style="margin:0 0 12px;font-size:0.83rem;line-height:1.45;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">
                ${escapeHtml(rx.description || '')}
              </p>
            </div>

            <div>
              <div class="recipe-macro-strip" style="margin-bottom:12px;">
                <div class="recipe-macro-cell">
                  <span>Kcal</span>
                  <strong>${rx.macros?.calories || 0}</strong>
                </div>
                <div class="recipe-macro-cell">
                  <span>Grasas</span>
                  <strong>${rx.macros?.fat || 0}g</strong>
                </div>
                <div class="recipe-macro-cell">
                  <span>Proteína</span>
                  <strong>${rx.macros?.protein || 0}g</strong>
                </div>
                <div class="recipe-macro-cell">
                  <span>Carbs Netos</span>
                  <strong>${rx.macros?.netCarbs || 0}g</strong>
                </div>
                <div class="recipe-macro-cell">
                  <span>Fibra</span>
                  <strong>${rx.macros?.fiber || 0}g</strong>
                </div>
              </div>

              <div style="display:flex;gap:8px;">
                <button type="button" class="secondary" style="flex:1;" data-action="open-recipe-modal" data-recipe-id="${escapeHtml(rx.id)}">
                  📖 Ingredientes y Preparación (${(rx.ingredients || []).length})
                </button>
                <button type="button" data-action="quick-log-recipe" data-recipe-id="${escapeHtml(rx.id)}">
                  + Registrar
                </button>
              </div>
            </div>
          </article>
        `).join('')}
      </div>

      ${visible.length < filtered.length ? `
        <div class="load-more-wrap">
          <button type="button" data-action="load-more-recipes">
            Mostrar más recetas (${filtered.length - visible.length} restantes)
          </button>
        </div>
      ` : ''}
    `;
  }

  // ── 6. Render: Modular Profile, Auto-Indices, Health & History View ──
  function renderProfile() {
    const prof = getActiveProfile();
    const m = computeProfileMetrics(prof);
    const unit = prof.heightUnit || 'ft_in';
    const inches = Number(prof.heightIn) || 69;
    const cmVal = (inches * 2.54).toFixed(1);
    const mVal = ((inches * 2.54) / 100).toFixed(2);
    const ftVal = Math.floor(inches / 12);
    const remInVal = Math.round(inches - ftVal * 12);
    const subTab = state.profileSubTab || 'biometria';
    const logs = state.workoutLogs.filter((l) => l.profileId === prof.id);

    return `
      <!-- Sub-Navigation inside Profile so it's never visually crowded -->
      <div class="branch-stepper" style="margin-bottom:18px;">
        <button type="button" class="branch-step-btn ${subTab === 'biometria' ? 'is-active' : ''}" data-action="open-profile-tab" data-subtab="biometria">
          1️⃣ Altura, Peso e Índices Auto-Calculables
        </button>
        <button type="button" class="branch-step-btn ${subTab === 'salud' ? 'is-active' : ''}" data-action="open-profile-tab" data-subtab="salud">
          2️⃣ Equipo Disponible, Lesiones y Salud
        </button>
        <button type="button" class="branch-step-btn ${subTab === 'historial' ? 'is-active' : ''}" data-action="open-profile-tab" data-subtab="historial">
          3️⃣ Historial de Entrenamientos (${logs.length})
        </button>
        <button type="button" class="branch-step-btn ${subTab === 'json' ? 'is-active' : ''}" data-action="open-profile-tab" data-subtab="json">
          4️⃣ Descargar / Cargar Perfil (.JSON)
        </button>
      </div>

      ${subTab === 'biometria' ? `
        <section class="panel">
          <form id="profileForm">
            <span class="eyebrow">FORMATO DE ALTURA FLEXIBLE E ÍNDICES AUTOMÁTICOS</span>
            <h3 style="margin:4px 0 14px;">Datos Básicos de ${escapeHtml(prof.name)}</h3>

            <div class="form-grid">
              <div class="field">
                <label>Nombre del perfil</label>
                <input type="text" name="name" value="${escapeHtml(prof.name)}" required />
              </div>
              <div class="field">
                <label>Sexo biológico</label>
                <select name="sex">
                  <option value="hombre" ${prof.sex === 'hombre' ? 'selected' : ''}>Hombre</option>
                  <option value="mujer" ${prof.sex === 'mujer' ? 'selected' : ''}>Mujer</option>
                </select>
              </div>
              <div class="field">
                <label>Edad (años)</label>
                <input type="number" name="age" min="14" max="95" value="${prof.age}" />
              </div>
              <div class="field">
                <label>Peso actual (lb)</label>
                <input type="number" name="weightLb" min="60" max="550" step="0.5" value="${prof.weightLb}" />
              </div>

              <div class="field">
                <label>Formato de Altura</label>
                <select name="heightUnit" id="profileHeightUnitSelect">
                  <option value="ft_in" ${unit === 'ft_in' ? 'selected' : ''}>Pies y pulgadas (ft / in)</option>
                  <option value="cm" ${unit === 'cm' ? 'selected' : ''}>Centímetros (cm)</option>
                  <option value="m" ${unit === 'm' ? 'selected' : ''}>Metros (m)</option>
                  <option value="in" ${unit === 'in' ? 'selected' : ''}>Pulgadas totales (in)</option>
                </select>
              </div>

              ${unit === 'ft_in' ? `
                <div class="field">
                  <label>Altura: Pies (ft)</label>
                  <input type="number" id="heightFtInput" min="3" max="7" step="1" value="${ftVal}" />
                </div>
                <div class="field">
                  <label>Altura: Pulgadas (in)</label>
                  <input type="number" id="heightRemInInput" min="0" max="11" step="1" value="${remInVal}" />
                </div>
              ` : ''}

              ${unit === 'cm' ? `
                <div class="field wide">
                  <label>Altura en Centímetros (cm)</label>
                  <input type="number" id="heightCmInput" min="120" max="230" step="0.5" value="${cmVal}" />
                </div>
              ` : ''}

              ${unit === 'm' ? `
                <div class="field wide">
                  <label>Altura en Metros (m)</label>
                  <input type="number" id="heightMInput" min="1.20" max="2.30" step="0.01" value="${mVal}" />
                </div>
              ` : ''}

              ${unit === 'in' ? `
                <div class="field wide">
                  <label>Altura en Pulgadas totales (in)</label>
                  <input type="number" id="heightTotalInInput" min="48" max="90" step="0.5" value="${inches}" />
                </div>
              ` : ''}

              <div class="field">
                <label>Tu Nivel de Experiencia</label>
                <select name="level">
                  <option value="novato" ${prof.level === 'novato' ? 'selected' : ''}>Principiante (Novato)</option>
                  <option value="intermedio" ${prof.level === 'intermedio' ? 'selected' : ''}>Intermedio</option>
                  <option value="avanzado" ${prof.level === 'avanzado' ? 'selected' : ''}>Avanzado</option>
                </select>
              </div>

              <div class="field">
                <label>Objetivo Principal</label>
                <select name="goal">
                  <option value="recomposicion" ${prof.goal === 'recomposicion' ? 'selected' : ''}>Recomposición Corporal</option>
                  <option value="perdida_grasa" ${prof.goal === 'perdida_grasa' ? 'selected' : ''}>Pérdida de Grasa (Déficit Keto)</option>
                  <option value="hipertrofia" ${prof.goal === 'hipertrofia' ? 'selected' : ''}>Fuerza e Hipertrofia Muscular</option>
                </select>
              </div>
            </div>

            <div class="calculation-panel">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
                <h3 style="margin:0;">Índices Corporales Auto-Calculados en Vivo</h3>
                <span class="tag">✨ ${escapeHtml(m.methodLabel)}</span>
              </div>
              <div class="metrics">
                <div class="metric">
                  <span>% Grasa Corporal (Auto)</span>
                  <strong id="autoBodyFatDisplay">${m.bodyFatPct}%</strong>
                  <small id="autoFatMassDisplay">${m.fatMassLb} lb de grasa</small>
                </div>
                <div class="metric">
                  <span>💪 Masa Magra y Muscular</span>
                  <strong id="autoLeanMassDisplay">${m.leanMassLb} lb magras</strong>
                  <small id="autoMuscleMassDisplay">~${m.skeletalMuscleMassLb} lb músculo (${m.skeletalMusclePct}%)</small>
                </div>
                <div class="metric">
                  <span>📊 IMC &amp; FFMI</span>
                  <strong id="autoBmiDisplay">${m.bmi} IMC</strong>
                  <small id="autoBmiCatDisplay">${escapeHtml(m.bmiCategory)}</small>
                </div>
                <div class="metric">
                  <span>🔥 Meta Diaria Keto</span>
                  <strong id="autoCalTargetDisplay">${m.suggestedCalories} kcal</strong>
                  <small id="autoMacroTargetDisplay">${m.suggestedProtein}g Prot · ${m.suggestedNetCarbs}g Carbs</small>
                </div>
              </div>
            </div>

            <div class="optional-toggle-banner">
              <div>
                <strong style="color:var(--green);font-size:0.9rem;">📏 Medidas avanzadas con cinta métrica (Cuello, Cintura, Cadera — 100% Opcional)</strong>
                <p class="muted" style="margin:2px 0 0;font-size:0.78rem;">
                  Desactivado por defecto para tu comodidad. Actívalo solo si deseas ingresar cuello/cintura manualmente.
                </p>
              </div>
              <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:850;color:var(--green);">
                <input type="checkbox" id="toggleTapeMeasurements" ${prof.useTapeMeasurements ? 'checked' : ''} style="width:18px;height:18px;min-height:18px;accent-color:var(--green);" />
                <span>${prof.useTapeMeasurements ? 'Activado' : 'Activar medidas opcionales'}</span>
              </label>
            </div>

            ${prof.useTapeMeasurements ? `
              <div class="form-grid" style="margin-top:12px;">
                <div class="field"><label>Cuello (in)</label><input type="number" name="neckIn" step="0.25" value="${prof.neckIn || 15.5}" /></div>
                <div class="field"><label>Cintura (in)</label><input type="number" name="waistIn" step="0.25" value="${prof.waistIn || 34}" /></div>
                <div class="field"><label>Cadera (in)</label><input type="number" name="hipIn" step="0.25" value="${prof.hipIn || 39}" /></div>
                <div class="field"><label>Pecho (in)</label><input type="number" name="chestIn" step="0.25" value="${prof.chestIn || 40}" /></div>
                <div class="field"><label>Brazo (in)</label><input type="number" name="armIn" step="0.25" value="${prof.armIn || 14}" /></div>
                <div class="field"><label>Muslo (in)</label><input type="number" name="thighIn" step="0.25" value="${prof.thighIn || 22}" /></div>
              </div>
            ` : ''}

            <div class="actions" style="margin-top:16px;flex-wrap:wrap;gap:10px;">
              <button type="submit">💾 Guardar Biometría</button>
              <button type="button" class="secondary" style="border-color:rgba(57,255,20,0.45);color:var(--green);" data-action="export-profile-json">
                ⬇️ Descargar Perfil (.JSON)
              </button>
              <button type="button" class="secondary" data-action="trigger-import-json">
                ⬆️ Cargar Perfil (.JSON)
              </button>
            </div>
          </form>
        </section>
      ` : ''}

      ${subTab === 'salud' ? `
        <section class="panel">
          <span class="eyebrow">ADAPTACIÓN INTELIGENTE DE EJERCICIOS Y NUTRICIÓN</span>
          <h3 style="margin:4px 0 12px;">Equipo Disponible, Lesiones Articulares y Condiciones Médicas</h3>

          <div style="display:grid;gap:18px;">
            <div>
              <label style="font-size:0.84rem;font-weight:850;color:var(--green);">🏋️ 1. Equipo disponible (La rutina filtra ejercicios según lo que tienes):</label>
              <div class="profile-chip-group">
                ${EQUIPMENT_CHIPS.map((c) => {
                  const isSel = (prof.equipmentTags || []).includes(c.id);
                  return `
                    <button type="button" class="profile-select-chip ${isSel ? 'is-selected' : ''}" data-action="toggle-profile-chip" data-chip-type="equipmentTags" data-chip-id="${escapeHtml(c.id)}">
                      ${isSel ? '✓ ' : ''}${escapeHtml(c.label)}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <div>
              <label style="font-size:0.84rem;font-weight:850;color:var(--green);">🩹 2. Lesiones o molestias articulares (Sustituye ejercicios de impacto por variantes seguras del mismo músculo):</label>
              <div class="profile-chip-group">
                ${INJURY_CHIPS.map((c) => {
                  const isSel = (prof.injuryTags || []).includes(c.id);
                  return `
                    <button type="button" class="profile-select-chip ${isSel ? 'is-selected' : ''}" data-action="toggle-profile-chip" data-chip-type="injuryTags" data-chip-id="${escapeHtml(c.id)}">
                      ${isSel ? '🛡️ ' : ''}${escapeHtml(c.label)}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>

            <div>
              <label style="font-size:0.84rem;font-weight:850;color:var(--green);">🩺 3. Condiciones médicas (Ajusta RPE, respiración y macros del Plan Keto):</label>
              <div class="profile-chip-group">
                ${MEDICAL_CHIPS.map((c) => {
                  const isSel = (prof.medicalTags || []).includes(c.id);
                  return `
                    <button type="button" class="profile-select-chip ${isSel ? 'is-selected' : ''}" data-action="toggle-profile-chip" data-chip-type="medicalTags" data-chip-id="${escapeHtml(c.id)}">
                      ${isSel ? '✓ ' : ''}${escapeHtml(c.label)}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <div class="profile-impact-box">
            <h4 style="margin:0 0 8px;color:var(--green);">💡 ¿Qué aporta FitRecord con tus selecciones actuales?</h4>
            <div class="calc-note-grid">
              <div class="calc-note">
                <strong>Equipo y Nivel (${escapeHtml(prof.level.toUpperCase())})</strong><br>
                Filtra los 1,324 ejercicios para priorizar tus ${prof.equipmentTags.length} tipos de equipo y dificultad acorde a tu experiencia.
              </div>
              <div class="calc-note">
                <strong>Protección Articular</strong><br>
                ${prof.injuryTags.length
                  ? prof.injuryTags.map((id) => INJURY_CHIPS.find((x) => x.id === id)?.desc).filter(Boolean).join(' ')
                  : 'Ninguna lesión marcada: todos los patrones biomecánicos habilitados.'}
              </div>
              <div class="calc-note">
                <strong>Condiciones Médicas &amp; Keto</strong><br>
                ${prof.medicalTags.length
                  ? prof.medicalTags.map((id) => MEDICAL_CHIPS.find((x) => x.id === id)?.desc).filter(Boolean).join(' ')
                  : 'Parámetros estándar activos.'}
              </div>
            </div>
          </div>
        </section>
      ` : ''}

      ${subTab === 'historial' ? `
        <section class="panel">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
            <h3 style="margin:0;">Bitácora de Series, Tiempos y Calorías Quemadas (${logs.length})</h3>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="secondary" style="border-color:rgba(57,255,20,0.45);color:var(--green);" data-action="export-profile-json">
                ⬇️ Descargar Perfil + Historial (.JSON)
              </button>
              <button type="button" class="secondary" data-action="trigger-import-json">
                ⬆️ Cargar .JSON
              </button>
            </div>
          </div>
          ${logs.length === 0 ? `
            <div class="empty-state">Aún no hay registros guardados. Ve a "Entrenar Hoy" para registrar tu primera serie o sesión por tiempo.</div>
          ` : `
            <table class="progress-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Ejercicio</th>
                  <th>Músculo / Modalidad</th>
                  <th>Detalle</th>
                  <th>🔥 Calorías</th>
                </tr>
              </thead>
              <tbody>
                ${logs.slice().reverse().map((l) => {
                  const ex = EXERCISE_BY_ID.get(String(l.exerciseId));
                  return `
                    <tr>
                      <td><strong>${escapeHtml(l.date)}</strong></td>
                      <td>${escapeHtml(ex ? ex.name : l.exerciseId)}</td>
                      <td>${escapeHtml(ex ? `${ex.targetEs} · ${ex.modalityEs}` : '-')}</td>
                      <td>
                        ${l.mode === 'time'
                          ? `⏱️ ${l.durationMin}m ${l.durationSec || 0}s (${l.sets || 1} bloq) · RPE ${l.rpe}`
                          : `🏋️ ${l.sets} × ${l.reps} reps @ ${l.weightLb} lb · RPE ${l.rpe}`}
                      </td>
                      <td><strong style="color:var(--green);">🔥 ${l.caloriesBurned || 0} kcal</strong></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
        </section>
      ` : ''}

      ${subTab === 'json' ? `
        <section class="panel">
          <span class="eyebrow">PORTABILIDAD MULTI-DISPOSITIVO (CELULAR, TABLET Y PC)</span>
          <h3 style="margin:4px 0 10px;">Sincronizar y Respaldar Perfil en Archivo .JSON</h3>
          <p class="muted" style="margin:0 0 18px;font-size:0.9rem;line-height:1.55;">
            Descarga tu perfil actualizado en un archivo <strong>.json</strong> para llevar tus medidas, nivel, lesiones, equipo disponible, historial de entrenamientos, registros Keto y rutinas a cualquier otro dispositivo.
          </p>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">
            <div class="calculation-panel" style="margin:0;display:flex;flex-direction:column;justify-content:space-between;gap:14px;">
              <div>
                <span class="tag" style="margin-bottom:8px;display:inline-block;">👤 PERFIL ACTIVO</span>
                <h4 style="margin:0 0 6px;font-size:1.02rem;color:var(--green);">1. Descargar Perfil "${escapeHtml(prof.name)}" (.JSON)</h4>
                <p class="muted" style="margin:0;font-size:0.83rem;line-height:1.45;">
                  Incluye tus datos biométricos (${formatHeightDisplay(prof.heightIn, prof.heightUnit)}, ${prof.weightLb} lb, ${m.bodyFatPct}% grasa), equipo, lesiones, <strong>${logs.length} entrenamientos</strong> y comidas Keto registradas.
                </p>
              </div>
              <button type="button" data-action="export-profile-json" style="width:100%;">
                ⬇️ Descargar Perfil Activo (.JSON)
              </button>
            </div>

            <div class="calculation-panel" style="margin:0;display:flex;flex-direction:column;justify-content:space-between;gap:14px;">
              <div>
                <span class="tag" style="margin-bottom:8px;display:inline-block;">⬆️ IMPORTAR / ACTUALIZAR</span>
                <h4 style="margin:0 0 6px;font-size:1.02rem;color:var(--green);">2. Cargar Perfil desde Archivo .JSON</h4>
                <p class="muted" style="margin:0;font-size:0.83rem;line-height:1.45;">
                  Selecciona un archivo <code>.json</code> descargado desde tu celular o PC. FitRecord actualizará el perfil y fusionará tus series y comidas sin perder tus datos previos.
                </p>
              </div>
              <button type="button" class="secondary" data-action="trigger-import-json" style="width:100%;border-color:rgba(57,255,20,0.5);color:var(--green);">
                ⬆️ Seleccionar Archivo .JSON para Cargar
              </button>
            </div>

            <div class="calculation-panel" style="margin:0;display:flex;flex-direction:column;justify-content:space-between;gap:14px;">
              <div>
                <span class="tag" style="margin-bottom:8px;display:inline-block;">📦 RESPALDO TOTAL</span>
                <h4 style="margin:0 0 6px;font-size:1.02rem;color:#d9ecdc;">3. Backup Completo (${state.profiles.length} Perfiles)</h4>
                <p class="muted" style="margin:0;font-size:0.83rem;line-height:1.45;">
                  Descarga absolutamente todos los perfiles creados en este dispositivo junto con todo el historial global de la aplicación.
                </p>
              </div>
              <button type="button" class="secondary" data-action="export-full-backup-json" style="width:100%;">
                📦 Descargar Backup Completo (.JSON)
              </button>
            </div>
          </div>
        </section>
      ` : ''}
    `;
  }

  // ── Modals: Exercise 360° (with Integrated Timer!), Recipe Reader & PWA Install ──
  let currentModalExerciseId = null;

  function openExerciseModal(exId) {
    const ex = EXERCISE_BY_ID.get(String(exId));
    if (!ex) return;
    currentModalExerciseId = String(ex.id);
    const modal = document.getElementById('exerciseModal');
    const titleEl = document.getElementById('modalExTitle');
    const subEl = document.getElementById('modalExSubtitle');
    const metaTop = document.getElementById('modalExMetaTop');
    const bodyEl = document.getElementById('modalExBody');
    if (!modal || !bodyEl) return;

    const prof = getActiveProfile();
    const isFav = state.favorites.includes(ex.id);
    const defaultMode = ex.trackingType === 'reps_weight' ? 'reps' : 'time';
    const activeMode = state.trackingModeOverride[ex.id] || defaultMode;
    const ytLinks = getThreeYouTubeLinks(ex);
    const variants = getSameMuscleVariants(ex, 4);
    const date = state.selectedDate || todayIso();

    const initialCal = estimateExerciseCalories(ex, {
      mode: activeMode,
      sets: ex.defaultSets || 3,
      reps: ex.defaultReps || 10,
      weightLb: ex.defaultWeightLb ?? 45,
      durationMin: ex.defaultMinutes ?? 20,
      durationSec: ex.defaultSeconds ?? 0,
      rpe: 8
    });

    if (metaTop) metaTop.textContent = `EJERCICIO #${ex.id} · ${ex.group.toUpperCase()} · ${ex.modalityEs.toUpperCase()}`;
    if (titleEl) titleEl.textContent = ex.name;
    if (subEl) subEl.textContent = `Músculo objetivo: ${ex.targetEs} · Equipamiento: ${ex.equipmentEs}`;

    bodyEl.innerHTML = `
      <div style="margin-top:14px;">
        <!-- Built-In Exercise Timer right at the top of the Exercise Modal! -->
        ${renderEmbeddedExerciseTimer(ex)}
      </div>

      <div class="modal-hero-grid" style="margin-top:12px;">
        <div>
          <div class="exercise-visual-frame">
            <img src="${escapeHtml(ex.gif_url || ex.image)}" alt="${escapeHtml(ex.name)}" />
            <div class="media-badge-overlay">
              <span class="id-pill">#${escapeHtml(ex.id)}</span>
              <span class="gif-status-pill">${activeMode === 'time' ? '⏱️ POR TIEMPO' : 'GIF HD'}</span>
            </div>
          </div>
          <div class="media-controls-bar" style="margin-top:10px;">
            <button type="button" data-action="add-to-today-routine" data-ex-id="${escapeHtml(ex.id)}">⚡ Agregar a Rutina Hoy</button>
            <button type="button" class="secondary ${isFav ? 'is-fav' : ''}" data-action="toggle-favorite" data-ex-id="${escapeHtml(ex.id)}">
              ${isFav ? '★ Favorito' : '☆ Favorito'}
            </button>
          </div>

          <div style="margin-top:12px;">
            <span class="eyebrow" style="display:block;margin-bottom:6px;">📺 3 OPCIONES DE VIDEO EN YOUTUBE (${escapeHtml(ex.targetEs)})</span>
            <div class="yt-options-row" style="grid-template-columns:1fr;gap:6px;">
              ${ytLinks.map((yt) => `
                <a class="yt-option-link" href="${escapeHtml(yt.url)}" target="_blank" rel="noopener noreferrer">
                  ${escapeHtml(yt.label)}
                </a>
              `).join('')}
            </div>
          </div>

          ${variants.length ? `
            <div class="variant-switcher-box" style="margin-top:12px;">
              <strong style="color:var(--green);font-size:0.8rem;">🔄 Variantes del Mismo Músculo (${escapeHtml(ex.targetEs)}):</strong>
              <div style="display:grid;gap:6px;margin-top:8px;">
                ${variants.map((v) => `
                  <div class="variant-mini-card" data-action="open-exercise-modal" data-ex-id="${escapeHtml(v.id)}">
                    <img src="${escapeHtml(v.gif_url || v.image)}" alt="${escapeHtml(v.name)}" />
                    <div class="variant-mini-info">
                      <strong>${escapeHtml(v.name)}</strong>
                      <small>${escapeHtml(v.modalityEs)}</small>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div>
          <div class="detail-grid" style="margin-top:0;">
            <div class="detail-block" style="border-top:0;padding-top:0;">
              <h4>Músculos Principales</h4>
              <ul>${(ex.primaryMuscles || []).map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
            </div>
            <div class="detail-block" style="border-top:0;padding-top:0;">
              <h4>Músculos Secundarios</h4>
              <ul>${(ex.secondaryMuscles?.length ? ex.secondaryMuscles : ['Core y estabilizadores']).map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>
            </div>
            <div class="detail-block full">
              <h4>Instrucciones Paso a Paso</h4>
              <ol>${(ex.instruction_steps?.es || []).map((st) => `<li>${escapeHtml(st)}</li>`).join('')}</ol>
            </div>
          </div>

          <div class="logged-sets-box" style="padding:14px;margin-top:14px;">
            <div class="tracking-mode-bar">
              <h4 style="margin:0;">
                ${activeMode === 'time' ? `⏱️ REGISTRAR TIEMPO Y CALORÍAS (${date})` : `🏋️ REGISTRAR SERIE AHORA (${date})`}
              </h4>
              <div class="tracking-mode-switch">
                <button type="button" class="tracking-mode-btn ${activeMode === 'time' ? 'is-active' : ''}" data-action="set-modal-tracking-mode" data-ex-id="${escapeHtml(ex.id)}" data-mode="time">
                  ⏱️ Por Tiempo
                </button>
                <button type="button" class="tracking-mode-btn ${activeMode === 'reps' ? 'is-active' : ''}" data-action="set-modal-tracking-mode" data-ex-id="${escapeHtml(ex.id)}" data-mode="reps">
                  🏋️ Por Reps/Peso
                </button>
              </div>
            </div>

            <form class="workout-log-form" id="modal-form-ex-${escapeHtml(ex.id)}" data-ex-id="${escapeHtml(ex.id)}" data-mode="${activeMode}">
              ${activeMode === 'time' ? `
                <div class="form-grid">
                  <div class="field">
                    <label>Duración (Minutos)</label>
                    <input type="number" name="durationMin" min="0" max="300" step="1" value="${ex.defaultMinutes ?? 20}" data-calc-cal="1" />
                  </div>
                  <div class="field">
                    <label>Segundos (s)</label>
                    <input type="number" name="durationSec" min="0" max="59" step="1" value="${ex.defaultSeconds ?? 0}" data-calc-cal="1" />
                  </div>
                  <div class="field">
                    <label>Bloques / Series</label>
                    <input type="number" name="sets" min="1" max="20" value="${ex.defaultSets || 1}" data-calc-cal="1" />
                  </div>
                  <div class="field">
                    <label>Intensidad RPE (1-10)</label>
                    <input type="number" name="rpe" min="1" max="10" value="8" data-calc-cal="1" />
                  </div>
                  <div class="field full">
                    <label>Notas</label>
                    <input type="text" name="notes" placeholder="Ej. Ritmo constante o HIIT" />
                  </div>
                </div>
              ` : `
                <div class="form-grid">
                  <div class="field">
                    <label>Series</label>
                    <input type="number" name="sets" min="1" max="20" value="${ex.defaultSets || 3}" data-calc-cal="1" />
                  </div>
                  <div class="field">
                    <label>Reps</label>
                    <input type="number" name="reps" min="1" max="100" value="${ex.defaultReps || 10}" data-calc-cal="1" />
                  </div>
                  <div class="field">
                    <label>Peso (lb)</label>
                    <input type="number" name="weightLb" min="0" max="1500" step="2.5" value="${ex.defaultWeightLb ?? 45}" data-calc-cal="1" />
                  </div>
                  <div class="field">
                    <label>RPE (1-10)</label>
                    <input type="number" name="rpe" min="1" max="10" value="8" data-calc-cal="1" />
                  </div>
                  <div class="field full">
                    <label>Notas</label>
                    <input type="text" name="notes" placeholder="Técnica controlada..." />
                  </div>
                </div>
              `}

              <div class="calorie-burn-banner">
                <div>
                  <span class="eyebrow" style="font-size:0.68rem;">🔥 CALORÍAS APROXIMADAS (${prof.weightLb} LB)</span>
                  <div style="font-size:0.88rem;color:#d9ecdc;">
                    Gasto estimado: <strong class="live-cal-value">~${initialCal.kcal} kcal</strong>
                    <span class="muted live-cal-meta">(${initialCal.activeMinutes} min activos · ${initialCal.effectiveMet} METs)</span>
                  </div>
                </div>
                <button type="submit">
                  ✓ Registrar (+Iniciar Descanso)
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    modal.hidden = false;
  }

  function openRecipeModal(rxId) {
    const rx = RECIPE_BY_ID.get(String(rxId));
    if (!rx) return;
    const modal = document.getElementById('recipeModal');
    const titleEl = document.getElementById('recipeModalTitle');
    const metaEl = document.getElementById('recipeModalMeta');
    const bodyEl = document.getElementById('recipeModalBody');
    if (!modal || !bodyEl) return;

    if (metaEl) metaEl.textContent = `${getMealBadgeLabel(rx.mealType).toUpperCase()} · RINDE: ${rx.servingsLabel || '2 porciones'} · TIEMPO: ${rx.prepTimeLabel || (rx.timeMinutes + ' min')}`;
    if (titleEl) titleEl.textContent = rx.name;

    bodyEl.innerHTML = `
      <p class="muted" style="margin:12px 0;font-size:0.92rem;line-height:1.55;">${escapeHtml(rx.description || '')}</p>

      <div class="recipe-macro-strip" style="margin-bottom:16px;">
        <div class="recipe-macro-cell"><span>Calorías</span><strong>${rx.macros?.calories || 0} kcal</strong></div>
        <div class="recipe-macro-cell"><span>Grasas</span><strong>${rx.macros?.fat || 0} g</strong></div>
        <div class="recipe-macro-cell"><span>Proteína</span><strong>${rx.macros?.protein || 0} g</strong></div>
        <div class="recipe-macro-cell"><span>Carbos Netos</span><strong>${rx.macros?.netCarbs || 0} g</strong></div>
        <div class="recipe-macro-cell"><span>Fibra</span><strong>${rx.macros?.fiber || 0} g</strong></div>
      </div>

      <div class="recipe-columns">
        <div>
          <h4 style="margin:0 0 10px;color:var(--green);text-transform:uppercase;font-size:0.84rem;">
            🛒 Ingredientes (${(rx.ingredients || []).length})
          </h4>
          <ul class="recipe-ing-list">
            ${(rx.ingredients || []).map((ing, idx) => {
              const isHeading = /^\[.*\]$/.test(ing);
              if (isHeading) {
                return `<li style="color:var(--green);font-weight:800;font-size:0.8rem;margin-top:4px;">${escapeHtml(ing.replace(/^\[|\]$/g, ''))}</li>`;
              }
              const ckKey = `${rx.id}__${idx}`;
              const checked = !!state.checkedIngredients[ckKey];
              return `
                <li class="recipe-ing-item">
                  <input type="checkbox" data-action="toggle-ingredient" data-ck-key="${escapeHtml(ckKey)}" ${checked ? 'checked' : ''} />
                  <span style="${checked ? 'text-decoration:line-through;opacity:0.6;' : ''}">${escapeHtml(ing)}</span>
                </li>
              `;
            }).join('')}
          </ul>
        </div>

        <div>
          <h4 style="margin:0 0 10px;color:var(--green);text-transform:uppercase;font-size:0.84rem;">
            👩‍🍳 Preparación Transcrita Paso a Paso
          </h4>
          <ol class="recipe-steps-ol">
            ${(rx.preparation?.steps || []).map((st) => `<li>${escapeHtml(st)}</li>`).join('')}
          </ol>
          ${(rx.preparation?.beginnerTips || []).length ? `
            <div class="logged-sets-box" style="margin-top:14px;">
              <h4>💡 Consejo Culinario</h4>
              <p style="margin:0;font-size:0.84rem;color:#d9ecdc;line-height:1.45;">
                ${escapeHtml(rx.preparation.beginnerTips.join(' '))}
              </p>
            </div>
          ` : ''}
        </div>
      </div>

      <div class="actions" style="margin-top:18px;justify-content:flex-end;">
        <button type="button" data-action="quick-log-recipe" data-recipe-id="${escapeHtml(rx.id)}">
          + Registrar 1 Porción en Mi Día Hoy
        </button>
      </div>
    `;

    modal.hidden = false;
  }

  async function triggerInstallApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice.catch(() => null);
      deferredInstallPrompt = null;
      if (choice && choice.outcome === 'accepted') {
        showToast('📲 ¡FitRecord Pro instalado con éxito!');
        return;
      }
    }
    const modal = document.getElementById('installModal');
    const body = document.getElementById('installModalBody');
    if (modal && body) {
      body.innerHTML = `
        <div style="display:grid;gap:14px;margin-top:12px;">
          <div class="calc-note">
            <strong>📱 En Celular Android (Chrome / Edge / Samsung Internet)</strong><br>
            Toca el menú de 3 puntos <strong>(⋮)</strong> del navegador y selecciona <strong>"Instalar aplicación"</strong> o <strong>"Añadir a pantalla de inicio"</strong>.
          </div>
          <div class="calc-note">
            <strong>🍎 En iPhone / iPad (Safari)</strong><br>
            Toca el botón <strong>Compartir (⬆️)</strong> en la barra inferior de Safari y elige <strong>"Agregar a Inicio" (Add to Home Screen)</strong>.
          </div>
          <div class="calc-note">
            <strong>💻 En PC Windows / Mac (Chrome o Edge)</strong><br>
            Haz clic en el icono de instalación <strong>(⊕ / 🖥️)</strong> situado a la derecha de la barra de direcciones para instalar FitRecord como app de escritorio independiente (estilo WorkoutGen).
          </div>
        </div>
      `;
      modal.hidden = false;
    }
  }

  // ── JSON Profile Export & Import (Multi-Device Portability) ──
  function slugifyFileName(str) {
    return String(str || 'perfil')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'perfil';
  }

  function downloadJsonFile(payload, filename) {
    const jsonText = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }

  function exportActiveProfileJson() {
    // Sync any unsaved form edits if currently on profile form
    const profileForm = document.getElementById('profileForm');
    const prof = getActiveProfile();
    if (profileForm) {
      prof.name = profileForm.querySelector('[name="name"]')?.value || prof.name;
      prof.sex = profileForm.querySelector('[name="sex"]')?.value || prof.sex;
      prof.age = Number(profileForm.querySelector('[name="age"]')?.value) || prof.age;
      prof.weightLb = Number(profileForm.querySelector('[name="weightLb"]')?.value) || prof.weightLb;
      prof.level = profileForm.querySelector('[name="level"]')?.value || prof.level;
      prof.goal = profileForm.querySelector('[name="goal"]')?.value || prof.goal;
      prof.heightIn = readHeightInFromForm(profileForm);
      const m = computeProfileMetrics(prof);
      prof.bodyFatPct = m.bodyFatPct;
      prof.leanMassLb = m.leanMassLb;
      prof.caloriesTarget = m.suggestedCalories;
      prof.proteinTarget = m.suggestedProtein;
      prof.netCarbTarget = m.suggestedNetCarbs;
      saveState();
    }

    const profLogs = state.workoutLogs.filter((l) => l.profileId === prof.id);
    const profNutrition = state.nutritionLogs.filter((l) => l.profileId === prof.id);

    const payload = {
      format: 'fitrecord-profile-v3',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      profile: prof,
      workoutLogs: profLogs,
      nutritionLogs: profNutrition,
      favorites: state.favorites || [],
      selectedGroupsByDate: state.selectedGroupsByDate || {},
      customRoutineIdsByDate: state.customRoutineIdsByDate || {},
      swappedExerciseBySlot: state.swappedExerciseBySlot || {},
      checkedIngredients: state.checkedIngredients || {}
    };

    const filename = `fitrecord-perfil-${slugifyFileName(prof.name)}-${todayIso()}.json`;
    downloadJsonFile(payload, filename);
    showToast(`⬇️ Perfil "${prof.name}" descargado como ${filename}`);
  }

  function exportFullBackupJson() {
    saveState();
    const payload = {
      format: 'fitrecord-full-backup-v3',
      version: '3.0',
      exportedAt: new Date().toISOString(),
      state: {
        activeProfileId: state.activeProfileId,
        profiles: state.profiles,
        workoutLogs: state.workoutLogs,
        nutritionLogs: state.nutritionLogs,
        favorites: state.favorites,
        selectedGroupsByDate: state.selectedGroupsByDate,
        customRoutineIdsByDate: state.customRoutineIdsByDate,
        swappedExerciseBySlot: state.swappedExerciseBySlot,
        checkedIngredients: state.checkedIngredients
      }
    };
    const filename = `fitrecord-backup-completo-${todayIso()}.json`;
    downloadJsonFile(payload, filename);
    showToast(`📦 Backup completo descargado (${state.profiles.length} perfiles).`);
  }

  function mergeById(existingArr, incomingArr) {
    const map = new Map();
    (Array.isArray(existingArr) ? existingArr : []).forEach((item) => {
      if (item && item.id) map.set(String(item.id), item);
    });
    (Array.isArray(incomingArr) ? incomingArr : []).forEach((item) => {
      if (item && item.id) map.set(String(item.id), item);
    });
    return Array.from(map.values());
  }

  function triggerImportJsonDialog() {
    const inp = document.getElementById('importJsonFileInput');
    if (inp) {
      inp.value = '';
      inp.click();
    }
  }

  function importProfileOrBackupJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        const defProf = createDefaultProfile('Perfil Importado');

        // Case 1: Full multi-profile backup
        if (data.format === 'fitrecord-full-backup-v3' && data.state && Array.isArray(data.state.profiles)) {
          data.state.profiles.forEach((incProf) => {
            const normalized = Object.assign({}, createDefaultProfile(incProf.name || 'Atleta'), incProf);
            const idx = state.profiles.findIndex((p) => p.id === normalized.id || p.name.toLowerCase() === normalized.name.toLowerCase());
            if (idx >= 0) state.profiles[idx] = normalized;
            else state.profiles.push(normalized);
          });
          if (data.state.activeProfileId) state.activeProfileId = data.state.activeProfileId;
          state.workoutLogs = mergeById(state.workoutLogs, data.state.workoutLogs);
          state.nutritionLogs = mergeById(state.nutritionLogs, data.state.nutritionLogs);
          state.favorites = Array.from(new Set([...(state.favorites || []), ...(data.state.favorites || [])]));
          Object.assign(state.selectedGroupsByDate, data.state.selectedGroupsByDate || {});
          Object.assign(state.customRoutineIdsByDate, data.state.customRoutineIdsByDate || {});
          Object.assign(state.swappedExerciseBySlot, data.state.swappedExerciseBySlot || {});
          Object.assign(state.checkedIngredients, data.state.checkedIngredients || {});
          saveState();
          render();
          showToast(`✅ Backup completo cargado (${data.state.profiles.length} perfiles sincronizados).`);
          return;
        }

        // Case 2: Single profile export (fitrecord-profile-v3) or raw profile object
        const rawProf = data.profile || (data.name || data.weightLb || data.heightIn ? data : null);
        if (!rawProf) {
          showToast('⚠️ El archivo .JSON no contiene un perfil válido de FitRecord.');
          return;
        }

        const importedProf = Object.assign({}, defProf, rawProf);
        if (!importedProf.id) importedProf.id = 'prof-' + Date.now();
        const m = computeProfileMetrics(importedProf);
        importedProf.bodyFatPct = m.bodyFatPct;
        importedProf.leanMassLb = m.leanMassLb;
        importedProf.caloriesTarget = m.suggestedCalories;
        importedProf.proteinTarget = m.suggestedProtein;
        importedProf.netCarbTarget = m.suggestedNetCarbs;

        const existingIdx = state.profiles.findIndex(
          (p) => p.id === importedProf.id || p.name.trim().toLowerCase() === importedProf.name.trim().toLowerCase()
        );
        let targetProfileId = importedProf.id;
        if (existingIdx >= 0) {
          targetProfileId = state.profiles[existingIdx].id;
          importedProf.id = targetProfileId;
          state.profiles[existingIdx] = importedProf;
        } else {
          state.profiles.push(importedProf);
        }

        state.activeProfileId = targetProfileId;

        if (Array.isArray(data.workoutLogs)) {
          const normalizedLogs = data.workoutLogs.map((l) => Object.assign({}, l, { profileId: targetProfileId }));
          state.workoutLogs = mergeById(state.workoutLogs, normalizedLogs);
        }
        if (Array.isArray(data.nutritionLogs)) {
          const normalizedNut = data.nutritionLogs.map((l) => Object.assign({}, l, { profileId: targetProfileId }));
          state.nutritionLogs = mergeById(state.nutritionLogs, normalizedNut);
        }
        if (Array.isArray(data.favorites)) {
          state.favorites = Array.from(new Set([...(state.favorites || []), ...data.favorites]));
        }
        if (data.selectedGroupsByDate) Object.assign(state.selectedGroupsByDate, data.selectedGroupsByDate);
        if (data.customRoutineIdsByDate) Object.assign(state.customRoutineIdsByDate, data.customRoutineIdsByDate);
        if (data.swappedExerciseBySlot) Object.assign(state.swappedExerciseBySlot, data.swappedExerciseBySlot);
        if (data.checkedIngredients) Object.assign(state.checkedIngredients, data.checkedIngredients);

        saveState();
        render();
        showToast(`✅ Perfil "${importedProf.name}" actualizado desde .JSON con éxito.`);
      } catch (err) {
        console.error(err);
        showToast('⚠️ Error al leer el archivo .JSON. Verifica que sea un archivo válido.');
      }
    };
    reader.readAsText(file);
  }

  // ── Main Render Dispatcher ────────────────────────────────
  function render() {
    syncWorkspaceChrome();
    const app = document.getElementById('app');
    if (!app) return;

    if (state.activeView === 'dashboard') app.innerHTML = renderDashboard();
    else if (state.activeView === 'workout') app.innerHTML = renderWorkout();
    else if (state.activeView === 'programs') app.innerHTML = renderPrograms();
    else if (state.activeView === 'library') app.innerHTML = renderLibrary();
    else if (state.activeView === 'nutrition') app.innerHTML = renderNutrition();
    else if (state.activeView === 'profile') app.innerHTML = renderProfile();
    else app.innerHTML = renderDashboard();
  }

  function readHeightInFromForm(form) {
    const prof = getActiveProfile();
    const unitSel = form.querySelector('[name="heightUnit"]');
    const unit = unitSel ? unitSel.value : prof.heightUnit;
    if (unit === 'ft_in') {
      const ft = Number(document.getElementById('heightFtInput')?.value ?? Math.floor(prof.heightIn / 12));
      const remIn = Number(document.getElementById('heightRemInInput')?.value ?? Math.round(prof.heightIn % 12));
      return Math.max(48, Math.min(90, ft * 12 + remIn));
    }
    if (unit === 'cm') {
      const cm = Number(document.getElementById('heightCmInput')?.value ?? prof.heightIn * 2.54);
      return Math.max(48, Math.min(90, Number((cm / 2.54).toFixed(2))));
    }
    if (unit === 'm') {
      const m = Number(document.getElementById('heightMInput')?.value ?? (prof.heightIn * 2.54) / 100);
      return Math.max(48, Math.min(90, Number(((m * 100) / 2.54).toFixed(2))));
    }
    const totIn = Number(document.getElementById('heightTotalInInput')?.value ?? prof.heightIn);
    return Math.max(48, Math.min(90, totIn));
  }

  // ── Event Delegation ──────────────────────────────────────
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('.sidebar-nav .nav-item');
    if (navBtn && navBtn.dataset.view) {
      state.activeView = navBtn.dataset.view;
      saveState();
      render();
      return;
    }

    if (e.target.closest('#sidebarCollapseBtn') || e.target.closest('#mobileSidebarToggle')) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      saveState();
      syncWorkspaceChrome();
      return;
    }

    if (e.target.closest('#installAppBtn') || e.target.closest('#topbarInstallBtn')) {
      triggerInstallApp();
      return;
    }

    const timerBtn = e.target.closest('[data-timer-sec]');
    if (timerBtn) {
      startGlobalOrExerciseTimer(Number(timerBtn.dataset.timerSec), null, 'countdown');
      return;
    }

    if (e.target.closest('#restTimerReset')) {
      resetExerciseTimer(0);
      return;
    }

    if (e.target.closest('#newProfileBtn')) {
      const name = prompt('Nombre del nuevo perfil:', `Atleta ${state.profiles.length + 1}`);
      if (name && name.trim()) {
        const np = createDefaultProfile(name.trim());
        state.profiles.push(np);
        state.activeProfileId = np.id;
        saveState();
        render();
        showToast(`👤 Perfil "${np.name}" creado.`);
      }
      return;
    }

    if (e.target.closest('#exportProfileJsonBtn')) {
      exportActiveProfileJson();
      return;
    }

    if (e.target.closest('#importProfileJsonBtn')) {
      triggerImportJsonDialog();
      return;
    }

    if (e.target.closest('#closeExerciseModal') || e.target.id === 'exerciseModal') {
      document.getElementById('exerciseModal').hidden = true;
      return;
    }
    if (e.target.closest('#closeRecipeModal') || e.target.id === 'recipeModal') {
      document.getElementById('recipeModal').hidden = true;
      return;
    }
    if (e.target.closest('#closeInstallModal') || e.target.id === 'installModal') {
      document.getElementById('installModal').hidden = true;
      return;
    }

    const actEl = e.target.closest('[data-action]');
    if (!actEl) return;
    const action = actEl.dataset.action;
    const prof = getActiveProfile();
    const date = state.selectedDate || todayIso();

    if (action === 'switch-view') {
      state.activeView = actEl.dataset.view || 'dashboard';
      saveState();
      render();
    } else if (action === 'open-profile-tab') {
      state.activeView = 'profile';
      state.profileSubTab = actEl.dataset.subtab || 'biometria';
      saveState();
      render();
    } else if (action === 'export-profile-json') {
      exportActiveProfileJson();
    } else if (action === 'export-full-backup-json') {
      exportFullBackupJson();
    } else if (action === 'trigger-import-json') {
      triggerImportJsonDialog();
    } else if (action === 'toggle-workout-accordion') {
      if (e.target.closest('[data-action="open-exercise-modal"]')) return;
      const exId = actEl.dataset.exId;
      state.openWorkoutExerciseId = String(state.openWorkoutExerciseId) === String(exId) ? null : exId;
      saveState();
      render();
    } else if (action === 'ex-timer-toggle') {
      const exId = actEl.dataset.exId;
      const defSec = Number(actEl.dataset.defaultSec) || 60;
      toggleExerciseTimer(exId, defSec);
    } else if (action === 'ex-timer-stopwatch') {
      startGlobalOrExerciseTimer(0, actEl.dataset.exId, 'stopwatch');
      showToast('⏱️ Cronómetro progresivo iniciado (00:00 →).');
    } else if (action === 'ex-timer-set') {
      const sec = Number(actEl.dataset.sec) || 60;
      startGlobalOrExerciseTimer(sec, null, 'countdown');
    } else if (action === 'ex-timer-apply-to-form') {
      const exId = actEl.dataset.exId;
      state.trackingModeOverride[exId] = 'time';
      const elapsedOrSelectedSec = Math.max(5, exTimerState.seconds || exTimerState.initialSeconds || 60);
      const mins = Math.floor(elapsedOrSelectedSec / 60);
      const secs = elapsedOrSelectedSec % 60;

      const modal = document.getElementById('exerciseModal');
      if (modal && !modal.hidden && String(currentModalExerciseId) === String(exId)) {
        openExerciseModal(exId);
      } else {
        render();
      }
      setTimeout(() => {
        document.querySelectorAll(`.workout-log-form[data-ex-id="${exId}"]`).forEach((form) => {
          const minInp = form.querySelector('[name="durationMin"]');
          const secInp = form.querySelector('[name="durationSec"]');
          if (minInp) minInp.value = mins;
          if (secInp) secInp.value = secs;
          minInp?.dispatchEvent(new Event('input', { bubbles: true }));
        });
        showToast(`✅ Tiempo aplicado al registro: ${mins}m ${secs}s`);
      }, 30);
    } else if (action === 'activate-coach-program') {
      const prog = COACH_PROGRAMS.find((p) => p.id === actEl.dataset.progId);
      if (prog) {
        state.selectedGroupsByDate[date] = prog.groups.slice();
        prof.preferredModality = prog.modality || 'todas';
        state.activeView = 'workout';
        state.openWorkoutExerciseId = null;
        saveState();
        render();
        showToast(`🏆 Programa activado: ${prog.title}`);
      }
    } else if (action === 'toggle-day-group') {
      const grp = actEl.dataset.group;
      const cur = getSelectedGroupsForDate(date).slice();
      const idx = cur.indexOf(grp);
      if (idx >= 0) {
        if (cur.length > 1) cur.splice(idx, 1);
      } else {
        cur.push(grp);
      }
      state.selectedGroupsByDate[date] = cur;
      saveState();
      render();
    } else if (action === 'select-preferred-modality') {
      prof.preferredModality = actEl.dataset.modality || 'todas';
      saveState();
      render();
      showToast(`🏋️ Modalidad activa: ${MODALITY_OPTIONS.find((m) => m.id === prof.preferredModality)?.short || 'Todas'}`);
    } else if (action === 'set-card-branch') {
      const exId = actEl.dataset.exId;
      state.cardBranchTabByEx[exId] = actEl.dataset.branch || 'log';
      saveState();
      render();
    } else if (action === 'set-tracking-mode') {
      const exId = actEl.dataset.exId;
      state.trackingModeOverride[exId] = actEl.dataset.mode;
      saveState();
      render();
    } else if (action === 'set-modal-tracking-mode') {
      const exId = actEl.dataset.exId;
      state.trackingModeOverride[exId] = actEl.dataset.mode;
      saveState();
      openExerciseModal(exId);
      if (state.activeView === 'workout') render();
    } else if (action === 'swap-exercise-variant') {
      const origId = actEl.dataset.origId;
      const newId = actEl.dataset.newId;
      state.swappedExerciseBySlot[`${date}__${origId}`] = newId;
      state.openWorkoutExerciseId = newId;
      state.cardBranchTabByEx[newId] = 'log';
      saveState();
      render();
      const newEx = EXERCISE_BY_ID.get(String(newId));
      showToast(`🔄 Variante activada: ${newEx ? newEx.name : newId} (${newEx ? newEx.targetEs : ''})`);
    } else if (action === 'open-exercise-modal') {
      e.stopPropagation();
      openExerciseModal(actEl.dataset.exId);
    } else if (action === 'open-recipe-modal') {
      openRecipeModal(actEl.dataset.recipeId);
    } else if (action === 'toggle-favorite') {
      e.stopPropagation();
      const exId = String(actEl.dataset.exId);
      const idx = state.favorites.indexOf(exId);
      if (idx >= 0) state.favorites.splice(idx, 1);
      else state.favorites.push(exId);
      saveState();
      render();
      if (!document.getElementById('exerciseModal').hidden && currentModalExerciseId === exId) {
        openExerciseModal(exId);
      }
    } else if (action === 'add-to-today-routine') {
      const exId = String(actEl.dataset.exId);
      if (!state.customRoutineIdsByDate[date]) state.customRoutineIdsByDate[date] = [];
      if (!state.customRoutineIdsByDate[date].includes(exId)) {
        state.customRoutineIdsByDate[date].push(exId);
      }
      state.openWorkoutExerciseId = exId;
      saveState();
      const ex = EXERCISE_BY_ID.get(exId);
      showToast(`⚡ "${ex ? ex.name : exId}" agregado a Entrenar Hoy.`);
      render();
    } else if (action === 'delete-workout-log') {
      state.workoutLogs = state.workoutLogs.filter((l) => l.id !== actEl.dataset.logId);
      saveState();
      render();
    } else if (action === 'quick-log-recipe') {
      const rx = RECIPE_BY_ID.get(String(actEl.dataset.recipeId));
      if (rx) {
        state.nutritionLogs.push({
          id: 'nlog-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          profileId: prof.id,
          date,
          recipeId: rx.id,
          mealType: rx.mealType || 'comida',
          servings: 1
        });
        saveState();
        render();
        showToast(`🥑 Registrado: ${rx.name} (+${rx.macros?.calories || 0} kcal · ${rx.macros?.netCarbs || 0}g carbs netos)`);
      }
    } else if (action === 'toggle-ingredient') {
      const key = actEl.dataset.ckKey;
      state.checkedIngredients[key] = !state.checkedIngredients[key];
      saveState();
    } else if (action === 'set-keto-meal-chip') {
      state.nutritionFilter.mealType = actEl.dataset.meal || 'todos';
      state.nutritionFilter.limit = 24;
      saveState();
      render();
    } else if (action === 'reset-keto-filters') {
      state.nutritionFilter = { search: '', mealType: 'todos', maxNetCarbs: 99, limit: 24 };
      saveState();
      render();
    } else if (action === 'set-lib-modality') {
      state.libraryFilter.modality = actEl.dataset.modality;
      state.libraryFilter.limit = 24;
      saveState();
      render();
    } else if (action === 'toggle-lib-time-cardio') {
      state.libraryFilter.trackingType = state.libraryFilter.trackingType === 'time_cardio' ? 'todos' : 'time_cardio';
      state.libraryFilter.limit = 24;
      saveState();
      render();
    } else if (action === 'toggle-lib-favs') {
      state.libraryFilter.onlyFavorites = !state.libraryFilter.onlyFavorites;
      saveState();
      render();
    } else if (action === 'reset-lib-filters') {
      state.libraryFilter = { search: '', group: 'Todos', modality: 'todas', level: 'todos', trackingType: 'todos', onlyFavorites: false, limit: 24 };
      saveState();
      render();
    } else if (action === 'load-more-exercises') {
      state.libraryFilter.limit = (state.libraryFilter.limit || 24) + 24;
      render();
    } else if (action === 'load-more-recipes') {
      state.nutritionFilter.limit = (state.nutritionFilter.limit || 24) + 24;
      render();
    } else if (action === 'toggle-profile-chip') {
      const chipType = actEl.dataset.chipType;
      const chipId = actEl.dataset.chipId;
      if (!Array.isArray(prof[chipType])) prof[chipType] = [];
      const idx = prof[chipType].indexOf(chipId);
      if (idx >= 0) prof[chipType].splice(idx, 1);
      else prof[chipType].push(chipId);
      const updated = computeProfileMetrics(prof);
      prof.bodyFatPct = updated.bodyFatPct;
      prof.leanMassLb = updated.leanMassLb;
      prof.caloriesTarget = updated.suggestedCalories;
      prof.proteinTarget = updated.suggestedProtein;
      prof.netCarbTarget = updated.suggestedNetCarbs;
      saveState();
      render();
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;

    if (t.dataset.calcCal === '1') {
      const form = t.closest('.workout-log-form');
      if (form) {
        const ex = EXERCISE_BY_ID.get(String(form.dataset.exId));
        const mode = form.dataset.mode || 'reps';
        const est = estimateExerciseCalories(ex, {
          mode,
          sets: form.querySelector('[name="sets"]')?.value,
          reps: form.querySelector('[name="reps"]')?.value,
          weightLb: form.querySelector('[name="weightLb"]')?.value,
          durationMin: form.querySelector('[name="durationMin"]')?.value,
          durationSec: form.querySelector('[name="durationSec"]')?.value,
          rpe: form.querySelector('[name="rpe"]')?.value
        });
        const valEl = form.querySelector('.live-cal-value');
        const metaEl = form.querySelector('.live-cal-meta');
        if (valEl) valEl.textContent = `~${est.kcal} kcal`;
        if (metaEl) metaEl.textContent = `(${est.activeMinutes} min activos · ${est.effectiveMet} METs)`;
      }
      return;
    }

    const profileForm = t.closest('#profileForm');
    if (profileForm && t.id !== 'profileHeightUnitSelect' && t.id !== 'toggleTapeMeasurements') {
      const prof = getActiveProfile();
      prof.name = profileForm.querySelector('[name="name"]')?.value || prof.name;
      prof.sex = profileForm.querySelector('[name="sex"]')?.value || prof.sex;
      prof.age = Number(profileForm.querySelector('[name="age"]')?.value) || prof.age;
      prof.weightLb = Number(profileForm.querySelector('[name="weightLb"]')?.value) || prof.weightLb;
      prof.level = profileForm.querySelector('[name="level"]')?.value || prof.level;
      prof.goal = profileForm.querySelector('[name="goal"]')?.value || prof.goal;
      prof.heightIn = readHeightInFromForm(profileForm);

      if (prof.useTapeMeasurements) {
        prof.neckIn = Number(profileForm.querySelector('[name="neckIn"]')?.value) || prof.neckIn;
        prof.waistIn = Number(profileForm.querySelector('[name="waistIn"]')?.value) || prof.waistIn;
        prof.hipIn = Number(profileForm.querySelector('[name="hipIn"]')?.value) || prof.hipIn;
      }

      const m = computeProfileMetrics(prof);
      prof.bodyFatPct = m.bodyFatPct;
      prof.leanMassLb = m.leanMassLb;
      prof.caloriesTarget = m.suggestedCalories;
      prof.proteinTarget = m.suggestedProtein;
      prof.netCarbTarget = m.suggestedNetCarbs;

      const bfEl = document.getElementById('autoBodyFatDisplay');
      const fmEl = document.getElementById('autoFatMassDisplay');
      const lmEl = document.getElementById('autoLeanMassDisplay');
      const mmEl = document.getElementById('autoMuscleMassDisplay');
      const bmiEl = document.getElementById('autoBmiDisplay');
      const bmiCatEl = document.getElementById('autoBmiCatDisplay');
      const calEl = document.getElementById('autoCalTargetDisplay');
      const macEl = document.getElementById('autoMacroTargetDisplay');

      if (bfEl) bfEl.textContent = `${m.bodyFatPct}%`;
      if (fmEl) fmEl.textContent = `${m.fatMassLb} lb de grasa`;
      if (lmEl) lmEl.textContent = `${m.leanMassLb} lb magras`;
      if (mmEl) mmEl.textContent = `~${m.skeletalMuscleMassLb} lb músculo (${m.skeletalMusclePct}%)`;
      if (bmiEl) bmiEl.textContent = `${m.bmi} IMC`;
      if (bmiCatEl) bmiCatEl.textContent = escapeHtml(m.bmiCategory);
      if (calEl) calEl.textContent = `${m.suggestedCalories} kcal`;
      if (macEl) macEl.textContent = `${m.suggestedProtein}g Prot · ${m.suggestedNetCarbs}g Carbs`;
      return;
    }

    if (t.id === 'libSearchInput') {
      state.libraryFilter.search = t.value;
      state.libraryFilter.limit = 24;
      render();
      const input = document.getElementById('libSearchInput');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    } else if (t.id === 'ketoSearchInput') {
      state.nutritionFilter.search = t.value;
      state.nutritionFilter.limit = 24;
      render();
      const input = document.getElementById('ketoSearchInput');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    const prof = getActiveProfile();

    if (t.id === 'profileSelect') {
      state.activeProfileId = t.value;
      saveState();
      render();
    } else if (t.id === 'importJsonFileInput') {
      const file = t.files && t.files[0];
      if (file) importProfileOrBackupJson(file);
    } else if (t.id === 'todayDateInput') {
      state.selectedDate = t.value || todayIso();
      saveState();
      render();
    } else if (t.id === 'profileHeightUnitSelect') {
      prof.heightUnit = t.value;
      saveState();
      render();
      showToast(`📏 Formato de altura cambiado a: ${t.options[t.selectedIndex].text}`);
    } else if (t.id === 'toggleTapeMeasurements') {
      prof.useTapeMeasurements = !!t.checked;
      const m = computeProfileMetrics(prof);
      prof.bodyFatPct = m.bodyFatPct;
      prof.leanMassLb = m.leanMassLb;
      saveState();
      render();
    } else if (t.id === 'libGroupSelect') {
      state.libraryFilter.group = t.value;
      state.libraryFilter.limit = 24;
      saveState();
      render();
    } else if (t.id === 'libModalitySelect') {
      state.libraryFilter.modality = t.value;
      state.libraryFilter.limit = 24;
      saveState();
      render();
    } else if (t.id === 'libLevelSelect') {
      state.libraryFilter.level = t.value;
      state.libraryFilter.limit = 24;
      saveState();
      render();
    } else if (t.id === 'ketoMealSelect') {
      state.nutritionFilter.mealType = t.value;
      state.nutritionFilter.limit = 24;
      saveState();
      render();
    } else if (t.id === 'ketoCarbSelect') {
      state.nutritionFilter.maxNetCarbs = Number(t.value) || 99;
      state.nutritionFilter.limit = 24;
      saveState();
      render();
    }
  });

  document.addEventListener('submit', (e) => {
    const workoutForm = e.target.closest('.workout-log-form');
    if (workoutForm) {
      e.preventDefault();
      const prof = getActiveProfile();
      const exId = String(workoutForm.dataset.exId);
      const ex = EXERCISE_BY_ID.get(exId);
      const mode = workoutForm.dataset.mode || 'reps';
      const date = state.selectedDate || todayIso();

      const sets = Number(workoutForm.querySelector('[name="sets"]')?.value) || 1;
      const reps = Number(workoutForm.querySelector('[name="reps"]')?.value) || 10;
      const weightLb = Number(workoutForm.querySelector('[name="weightLb"]')?.value) || 0;
      const durationMin = Number(workoutForm.querySelector('[name="durationMin"]')?.value) || 0;
      const durationSec = Number(workoutForm.querySelector('[name="durationSec"]')?.value) || 0;
      const rpe = Number(workoutForm.querySelector('[name="rpe"]')?.value) || 8;
      const notes = (workoutForm.querySelector('[name="notes"]')?.value || '').trim();

      const calEst = estimateExerciseCalories(ex, { mode, sets, reps, weightLb, durationMin, durationSec, rpe });

      state.workoutLogs.push({
        id: 'wlog-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        profileId: prof.id,
        date,
        exerciseId: exId,
        mode,
        sets,
        reps,
        weightLb,
        durationMin,
        durationSec,
        rpe,
        caloriesBurned: calEst.kcal,
        notes
      });

      saveState();
      startGlobalOrExerciseTimer(mode === 'time' ? 60 : 90, exId, 'countdown');
      render();
      showToast(
        mode === 'time'
          ? `⏱️ Tiempo registrado (${durationMin}m ${durationSec}s) · 🔥 ~${calEst.kcal} kcal quemadas`
          : `💪 Serie registrada (${sets}×${reps} @ ${weightLb} lb) · 🔥 ~${calEst.kcal} kcal · Descanso 90s activo`
      );
      return;
    }

    const profileForm = e.target.closest('#profileForm');
    if (profileForm) {
      e.preventDefault();
      const prof = getActiveProfile();
      prof.name = profileForm.querySelector('[name="name"]')?.value || prof.name;
      prof.sex = profileForm.querySelector('[name="sex"]')?.value || prof.sex;
      prof.age = Number(profileForm.querySelector('[name="age"]')?.value) || prof.age;
      prof.weightLb = Number(profileForm.querySelector('[name="weightLb"]')?.value) || prof.weightLb;
      prof.level = profileForm.querySelector('[name="level"]')?.value || prof.level;
      prof.goal = profileForm.querySelector('[name="goal"]')?.value || prof.goal;
      prof.heightIn = readHeightInFromForm(profileForm);

      if (prof.useTapeMeasurements) {
        prof.neckIn = Number(profileForm.querySelector('[name="neckIn"]')?.value) || prof.neckIn;
        prof.waistIn = Number(profileForm.querySelector('[name="waistIn"]')?.value) || prof.waistIn;
        prof.hipIn = Number(profileForm.querySelector('[name="hipIn"]')?.value) || prof.hipIn;
      }

      const m = computeProfileMetrics(prof);
      prof.bodyFatPct = m.bodyFatPct;
      prof.leanMassLb = m.leanMassLb;
      prof.caloriesTarget = m.suggestedCalories;
      prof.proteinTarget = m.suggestedProtein;
      prof.netCarbTarget = m.suggestedNetCarbs;

      saveState();
      render();
      showToast(`✅ Biometría guardada: ${m.bodyFatPct}% grasa · ${m.leanMassLb} lb masa magra.`);
    }
  });

  render();
})();
