document.addEventListener('DOMContentLoaded', () => {
    // --- REFERENCIAS A ELEMENTOS DEL FORMULARIO DE PERFIL ---
    const formPerfil = document.getElementById('formPerfil');
    const nombreInput = document.getElementById('nombre');
    const edadInput = document.getElementById('edad');
    const pesoInicialInput = document.getElementById('pesoInicial');
    const alturaInput = document.getElementById('altura');
    const hipertensionInput = document.getElementById('hipertension');
    const higadoGrasoInput = document.getElementById('higadoGraso');
    const currentYearSpan = document.getElementById('currentYear');

    // --- REFERENCIAS A ELEMENTOS DEL FORMULARIO DE REGISTRO DIARIO ---
    const formRegistroDiario = document.getElementById('formRegistroDiario');
    const fechaRegistroInput = document.getElementById('fechaRegistro');
    const pesoActualInput = document.getElementById('pesoActual');
    const presionSistolicaInput = document.getElementById('presionSistolica');
    const presionDiastolicaInput = document.getElementById('presionDiastolica');
    const desayunoInput = document.getElementById('desayuno');
    const almuerzoInput = document.getElementById('almuerzo');
    const cenaInput = document.getElementById('cena');
    const snacksInput = document.getElementById('snacks');
    const otrasBebidasInput = document.getElementById('otrasBebidas');
    const aguaConsumidaMLInput = document.getElementById('aguaConsumidaML');
    const actividadFisicaInput = document.getElementById('actividadFisica');

    // --- REFERENCIAS A ELEMENTOS DE VISUALIZACIÓN DE HISTORIAL Y ANÁLISIS ---
    const contenedorHistorial = document.getElementById('contenedorHistorial');
    const resumenFecha = document.getElementById('resumenFecha');
    const resumenPeso = document.getElementById('resumenPeso');
    const resumenIMC = document.getElementById('resumenIMC');
    const resumenPresion = document.getElementById('resumenPresion');

    // --- REFERENCIAS A ELEMENTOS DE PLAN DE DIETA ---
    const elSugerenciaDesayuno = document.getElementById('sugerenciaDesayuno');
    const elSugerenciaAlmuerzo = document.getElementById('sugerenciaAlmuerzo');
    const elSugerenciaCena = document.getElementById('sugerenciaCena');
    const elSugerenciaSnacks = document.getElementById('sugerenciaSnacks');
    const btnGenerarNuevoPlan = document.getElementById('btnGenerarNuevoPlan');

    // --- REFERENCIAS A ELEMENTOS DE RUTINA DE EJERCICIO ---
    const nombreRutinaDiv = document.getElementById('nombreRutina');
    const listaEjerciciosDiv = document.getElementById('listaEjerciciosSugeridos');
    const btnGenerarNuevaRutina = document.getElementById('btnGenerarNuevaRutina');

    // --- REFERENCIAS A ELEMENTOS DE GESTIÓN DE DATOS (BACKUP/RESTAURACIÓN) ---
    const btnDescargarBackup = document.getElementById('btnDescargarBackup');
    const inputArchivoBackup = document.getElementById('inputArchivoBackup');

    // --- CLAVES PARA LOCALSTORAGE ---
    const PERFIL_STORAGE_KEY = 'perfilUsuarioKetoApp';
    const REGISTROS_DIARIOS_STORAGE_KEY = 'registrosDiariosKetoApp';
    const KEY_INDICE_RUTINA_ACTUAL = 'indiceRutinaEjercicioActual';


    // --- DATOS EN MEMORIA ---
    let perfilUsuarioActual = {};
    let registrosDiarios = [];

    // --- INSTANCIAS DE GRÁFICOS ---
    let graficoPesoChart, graficoPresionChart, graficoIMCChart, graficoHidratacionChart;

    // --- DATOS DE RECETAS Y EJERCICIOS ---
    const enlaceLibroRecetas = "https://librerialatina.co/wp-content/uploads/2023/01/Dieta-Keto.-Recetas-faciles-con-5-ingredientes-1.pdf";
    const RECETAS_KETO_LIBRO = [
      { nombre: "Café Bulletproof", categoria: "desayuno", fuentePagina: "PDF p. 40", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Smoothie de aguacate y moras", categoria: "desayuno", fuentePagina: "PDF p. 40", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Frittata de cerdo", categoria: "desayuno", fuentePagina: "PDF p. 40", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Huevos revueltos picantes", categoria: "desayuno", fuentePagina: "PDF p. 40", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Waffles o panqueques de harina de coco y queso crema", categoria: "desayuno", fuentePagina: "PDF p. 40", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Ensalada griega picada", categoria: "almuerzo", fuentePagina: "PDF p. 83", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Ensalada César con salmón", categoria: "almuerzo", fuentePagina: "PDF p. 83", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Sopa de brócoli y queso", categoria: "almuerzo", fuentePagina: "PDF p. 83", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Quesadilla de pollo (con tortilla baja en carb.)", categoria: "almuerzo", fuentePagina: "PDF p. 167", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Salmón al ajo con queso parmesano y espárragos", categoria: "cena", fuentePagina: "PDF p. 167", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Piernas de pollo al horno con ajo y páprika", categoria: "cena", fuentePagina: "PDF p. 167", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Chuletas de cerdo con mantequilla y hierbas", categoria: "cena", fuentePagina: "PDF p. 209", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Asado de res y brócoli", categoria: "cena", fuentePagina: "PDF p. 209", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Queso frito con guacamole", categoria: "snack", fuentePagina: "PDF p. 125", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Huevos a la diabla", categoria: "snack", fuentePagina: "PDF p. 125", fuenteUrl: enlaceLibroRecetas },
      { nombre: "Jalapeños envueltos con tocino", categoria: "snack", fuentePagina: "PDF p. 125", fuenteUrl: enlaceLibroRecetas }
    ];

    const URL_LIBRO_EJERCICIOS = "https://www.realfitness.cl/admin/imagenes/descargas/Enciclopedia%20de%20ejercicios%20de%20musculacion.pdf";
    const EJERCICIOS_LIBRO = [
        { nombre: "Press de Banca (con barra)", grupoMuscular: "Pectorales", pagina: 36, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "Tumbado en banco plano, pies apoyados, sujetar la barra más ancho que los hombros. Bajar la barra al pecho medio y subir verticalmente. Inspirar al bajar, espirar al subir." },
        { nombre: "Aperturas con Mancuernas (planas)", grupoMuscular: "Pectorales", pagina: 44, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "Tumbado en banco plano, mancuernas sobre el pecho con palmas enfrentadas, codos semiflexionados. Bajar lateralmente hasta la altura del pectoral, subir hacia adentro. Inspirar al bajar, espirar al subir." },
        { nombre: "Press Militar (frontal con barra, sentado)", grupoMuscular: "Hombros", pagina: 108, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "Sentado en banco ligeramente inclinado, barra en pronación ancho de hombros. Bajar a la clavícula y subir casi completo. Inspirar al bajar, espirar al subir." },
        { nombre: "Elevaciones Laterales (con mancuernas, de pie)", grupoMuscular: "Hombros", pagina: 114, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "De pie, mancuernas a los lados, codos semiflexionados. Elevar brazos lateralmente hasta formar una cruz (90º). Bajar controlado. Inspirar al subir, espirar al bajar." },
        { nombre: "Press Francés (con barra, tumbado)", grupoMuscular: "Tríceps", pagina: 180, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "Tumbado supino, barra corta en pronación frente a los ojos. Bajar hacia la frente flexionando codos (sin moverlos de posición). Extender. Inspirar al bajar, espirar al subir." },
        { nombre: "Dominadas (agarre prono, al frente)", grupoMuscular: "Espalda", pagina: 72, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "Colgado de barra, manos en pronación más anchas que hombros. Tirar acercando pecho superior a la barra, arquear tronco. Inspirar al bajar, espirar al subir." },
        { nombre: "Remo con Barra (tronco inclinado)", grupoMuscular: "Espalda", pagina: 74, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "De pie, tronco inclinado 45º, rodillas semiflexionadas. Barra en pronación. Tirar con codos abiertos llevando barra a zona abdominal. Inspirar antes de bajar, apnea, espirar al final de subir." },
        { nombre: "Elevaciones Posteriores / Pájaros (de pie, inclinado)", grupoMuscular: "Hombros", pagina: 120, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "De pie, tronco inclinado casi horizontal, mancuernas colgando agarre neutro. Elevar lateralmente sin modificar flexión de codos hasta altura del tronco. Inspirar al subir, espirar al bajar."},
        { nombre: "Curl con Barra (de pie)", grupoMuscular: "Bíceps", pagina: 160, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "De pie, tronco bloqueado, barra en supinación ancho hombros. Levantar controlado hasta flexión máxima. Inspirar antes de subir, espirar al bajar." },
        { nombre: "Sentadilla (con barra, trasera)", grupoMuscular: "Piernas", pagina: 222, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "De pie, barra sobre trapecio. Pies ancho caderas, puntas afuera. Bajar flexionando rodillas (dirección pies) hasta muslos casi paralelos al suelo. Abdomen y lumbar contraídos. Inspirar al bajar, espirar al subir." },
        { nombre: "Peso Muerto (piernas semi-rígidas)", grupoMuscular: "Piernas", pagina: 228, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "De pie, piernas casi rectas, barra sobre muslos agarre prono. Bajar tronco sin arquear espalda, barra cerca del cuerpo. Localizar esfuerzo en isquios/glúteos. Inspirar al bajar, espirar al subir." },
        { nombre: "Contracciones Tumbado (Crunch)", grupoMuscular: "Abdominales", pagina: 274, urlLibro: URL_LIBRO_EJERCICIOS, descripcion: "Tumbado supino, rodillas flexionadas, pies en suelo o banco. Manos en pecho o cabeza (sin sostener). Elevar hombros contrayendo abdomen, redondear espalda. Lumbar apoyada. Inspirar al bajar, espirar al subir." }
    ];

    const RUTINAS_EJERCICIOS_CICLO = [
        { 
            nombreCiclo: "Rutina A: Énfasis Empuje (Pecho, Hombros, Tríceps)", 
            ejerciciosPropuestos: [
                { nombreEjercicio: "Press de Banca (con barra)", seriesYRepeticiones: "3 series de 8-12 reps" },
                { nombreEjercicio: "Press Militar (frontal con barra, sentado)", seriesYRepeticiones: "3 series de 8-12 reps" },
                { nombreEjercicio: "Elevaciones Laterales (con mancuernas, de pie)", seriesYRepeticiones: "3 series de 10-15 reps" },
                { nombreEjercicio: "Press Francés (con barra, tumbado)", seriesYRepeticiones: "3 series de 10-15 reps" }
            ]
        },
        { 
            nombreCiclo: "Rutina B: Énfasis Tirón (Espalda, Bíceps, Hombro Posterior)", 
            ejerciciosPropuestos: [
                { nombreEjercicio: "Dominadas (agarre prono, al frente)", seriesYRepeticiones: "3 series al fallo o Jalón Polea al Pecho 3x8-12" },
                { nombreEjercicio: "Remo con Barra (tronco inclinado)", seriesYRepeticiones: "3 series de 8-12 reps" },
                { nombreEjercicio: "Elevaciones Posteriores / Pájaros (de pie, inclinado)", seriesYRepeticiones: "3 series de 12-15 reps" },
                { nombreEjercicio: "Curl con Barra (de pie)", seriesYRepeticiones: "3 series de 8-12 reps" }
            ]
        },
        { 
            nombreCiclo: "Rutina C: Énfasis Piernas y Core", 
            ejerciciosPropuestos: [
                { nombreEjercicio: "Sentadilla (con barra, trasera)", seriesYRepeticiones: "4 series de 8-12 reps" },
                { nombreEjercicio: "Peso Muerto (piernas semi-rígidas)", seriesYRepeticiones: "3 series de 10-15 reps (peso moderado)" },
                { nombreEjercicio: "Elevaciones de Talones (de pie, con o sin lastre)", seriesYRepeticiones: "3 series de 15-20 reps" }, // Página 230
                { nombreEjercicio: "Contracciones Tumbado (Crunch)", seriesYRepeticiones: "3 series de 15-20 reps" }
            ]
        }
    ];
    
    // --- LÓGICA DE PERFIL DE USUARIO ---
    // (Las funciones cargarPerfil y guardarPerfil se mantienen como en la versión anterior)
    function cargarPerfil() {
        try {
            const perfilGuardado = localStorage.getItem(PERFIL_STORAGE_KEY);
            if (perfilGuardado) {
                const perfil = JSON.parse(perfilGuardado);
                perfilUsuarioActual = perfil; 

                nombreInput.value = perfil.nombre || '';
                edadInput.value = perfil.edad || '';
                pesoInicialInput.value = perfil.pesoInicial || '265';
                alturaInput.value = perfil.altura || '6.0';
                if (perfil.condiciones) {
                    hipertensionInput.value = perfil.condiciones.hipertension || 'High normal';
                    higadoGrasoInput.value = perfil.condiciones.higadoGraso || 'Nivel 3';
                } else { 
                    hipertensionInput.value = 'High normal';
                    higadoGrasoInput.value = 'Nivel 3';
                }
            } else {
                perfilUsuarioActual = {
                    nombre: '', edad: null, pesoInicial: 265, altura: 6.0,
                    condiciones: { hipertension: 'High normal', higadoGraso: 'Nivel 3' }
                };
            }
        } catch (e) {
            console.error('Error al cargar o parsear perfil de localStorage:', e);
            perfilUsuarioActual = { 
                altura: 6.0, 
                condiciones: { hipertension: 'High normal', higadoGraso: 'Nivel 3' } 
            }; 
        }
    }

    function guardarPerfil() {
        const perfil = {
            nombre: nombreInput.value.trim(),
            edad: edadInput.value ? parseInt(edadInput.value) : null,
            pesoInicial: pesoInicialInput.value ? parseFloat(pesoInicialInput.value) : null,
            altura: alturaInput.value ? parseFloat(alturaInput.value) : null,
            condiciones: {
                hipertension: hipertensionInput.value.trim(),
                higadoGraso: higadoGrasoInput.value.trim()
            }
        };
        perfilUsuarioActual = perfil; 

        try {
            localStorage.setItem(PERFIL_STORAGE_KEY, JSON.stringify(perfil));
            alert('¡Perfil guardado exitosamente!');
            mostrarHistorialYAnalisis(); 
        } catch (e) {
            console.error('Error al guardar en localStorage:', e);
            alert('Hubo un error al guardar el perfil.');
        }
    }

    // --- LÓGICA DE REGISTRO DIARIO ---
    // (Las funciones setDefaultDate, guardarRegistroDiario, cargarRegistrosDiarios se mantienen)
    function setDefaultDate() {
        if (fechaRegistroInput) {
            const hoy = new Date();
            const anio = hoy.getFullYear();
            const mes = String(hoy.getMonth() + 1).padStart(2, '0'); 
            const dia = String(hoy.getDate()).padStart(2, '0');
            fechaRegistroInput.value = `${anio}-${mes}-${dia}`;
        }
    }

    function guardarRegistroDiario() {
        const nuevoRegistro = {
            id: Date.now(), 
            fecha: fechaRegistroInput.value,
            pesoActual: pesoActualInput.value ? parseFloat(pesoActualInput.value) : null,
            presionSistolica: presionSistolicaInput.value ? parseInt(presionSistolicaInput.value) : null,
            presionDiastolica: presionDiastolicaInput.value ? parseInt(presionDiastolicaInput.value) : null,
            alimentacion: {
                desayuno: desayunoInput.value.trim(),
                almuerzo: almuerzoInput.value.trim(),
                cena: cenaInput.value.trim(),
                snacks: snacksInput.value.trim()
            },
            hidratacion: {
                otrasBebidas: otrasBebidasInput.value.trim(),
                aguaConsumidaML: aguaConsumidaMLInput.value ? parseInt(aguaConsumidaMLInput.value) : null
            },
            actividadFisica: actividadFisicaInput.value.trim()
        };

        registrosDiarios.push(nuevoRegistro);

        try {
            localStorage.setItem(REGISTROS_DIARIOS_STORAGE_KEY, JSON.stringify(registrosDiarios));
            alert('¡Registro diario guardado exitosamente!');
            formRegistroDiario.reset(); 
            setDefaultDate(); 
            mostrarHistorialYAnalisis(); 
        } catch (e) {
            console.error('Error al guardar el registro diario en localStorage:', e);
            alert('Hubo un error al guardar el registro diario.');
            registrosDiarios.pop(); 
        }
    }
    
    function cargarRegistrosDiarios() {
        try {
            const registrosGuardados = localStorage.getItem(REGISTROS_DIARIOS_STORAGE_KEY);
            if (registrosGuardados) {
                registrosDiarios = JSON.parse(registrosGuardados);
            } else {
                registrosDiarios = []; 
            }
        } catch (e) {
            console.error('Error al cargar o parsear registros diarios de localStorage:', e);
            registrosDiarios = []; 
        }
        mostrarHistorialYAnalisis(); 
    }

    // --- FUNCIONES DE ANÁLISIS Y VISUALIZACIÓN ---
    // (calcularIMC, clasificarPresionArterial, mostrarHistorialYAnalisis, renderizarGraficos se mantienen)
    function calcularIMC(pesoLbs, alturaPies) {
        if (!pesoLbs || !alturaPies || parseFloat(alturaPies) <= 0) {
            return null; 
        }
        const alturaMetros = parseFloat(alturaPies) * 0.3048;
        const pesoKg = parseFloat(pesoLbs) * 0.453592;
        if (alturaMetros === 0) return null; 
        return (pesoKg / (alturaMetros * alturaMetros)).toFixed(2);
    }

    function clasificarPresionArterial(sistolica, diastolica) {
        const sist = parseInt(sistolica);
        const diast = parseInt(diastolica);

        if (isNaN(sist) || isNaN(diast)) return "Datos incompletos";

        if (sist < 120 && diast < 80) return "Normal";
        if (sist >= 120 && sist <= 129 && diast < 80) return "Elevada";
        if ((sist >= 130 && sist <= 139) || (diast >= 80 && diast <= 89)) return "Hipertensión Etapa 1";
        if (sist > 180 || diast > 120) return "Crisis Hipertensiva"; 
        if (sist >= 140 || diast >= 90) return "Hipertensión Etapa 2";
        
        return "Revisar rangos"; 
    }

    function mostrarHistorialYAnalisis() { 
        if (!contenedorHistorial || !resumenFecha) return; 

        contenedorHistorial.innerHTML = ''; 

        if (registrosDiarios.length === 0) {
            contenedorHistorial.innerHTML = '<p>No hay registros todavía. ¡Añade tu primer registro diario!</p>';
            resumenFecha.textContent = '--';
            resumenPeso.textContent = '--';
            resumenIMC.textContent = '--';
            resumenPresion.textContent = '--';
            
            if (graficoPesoChart) graficoPesoChart.destroy();
            if (graficoPresionChart) graficoPresionChart.destroy();
            if (graficoIMCChart) graficoIMCChart.destroy();
            if (graficoHidratacionChart) graficoHidratacionChart.destroy();
            graficoPesoChart = null; graficoPresionChart = null; graficoIMCChart = null; graficoHidratacionChart = null;
            return;
        }

        const registrosInvertidos = [...registrosDiarios].reverse();

        registrosInvertidos.forEach(registro => {
            const imc = calcularIMC(registro.pesoActual, perfilUsuarioActual ? perfilUsuarioActual.altura : null);
            const estadoPresion = clasificarPresionArterial(registro.presionSistolica, registro.presionDiastolica);

            const entradaDiv = document.createElement('div');
            entradaDiv.className = 'entrada-historial';
            entradaDiv.innerHTML = `
                <h4>Fecha: ${registro.fecha}</h4>
                <p><strong>Peso:</strong> ${registro.pesoActual !== null ? registro.pesoActual + ' lbs' : 'N/A'}</p>
                <p><strong>IMC:</strong> ${imc || 'N/A (Verifica tu altura en el perfil)'}</p>
                <p><strong>Presión Arterial:</strong> 
                    ${registro.presionSistolica !== null ? registro.presionSistolica : 'N/A'} / 
                    ${registro.presionDiastolica !== null ? registro.presionDiastolica : 'N/A'} mmHg 
                    (${estadoPresion})
                </p>
                <div class="datos-comida">
                    <p><strong>Desayuno:</strong> ${registro.alimentacion.desayuno || 'No registrado'}</p>
                    <p><strong>Almuerzo:</strong> ${registro.alimentacion.almuerzo || 'No registrado'}</p>
                    <p><strong>Cena:</strong> ${registro.alimentacion.cena || 'No registrado'}</p>
                    <p><strong>Snacks:</strong> ${registro.alimentacion.snacks || 'No registrado'}</p>
                </div>
                <p><strong>Agua Consumida:</strong> ${registro.hidratacion.aguaConsumidaML !== null ? registro.hidratacion.aguaConsumidaML + ' mL' : 'N/A'}</p>
                <p><strong>Otras Bebidas:</strong> ${registro.hidratacion.otrasBebidas || 'No registrado'}</p>
                <p><strong>Actividad Física:</strong> ${registro.actividadFisica || 'No registrado'}</p>
            `;
            contenedorHistorial.appendChild(entradaDiv);
        });

        const ultimoRegistro = registrosInvertidos[0];
        if (ultimoRegistro) {
            const imcUltimo = calcularIMC(ultimoRegistro.pesoActual, perfilUsuarioActual ? perfilUsuarioActual.altura : null);
            const presionUltima = clasificarPresionArterial(ultimoRegistro.presionSistolica, ultimoRegistro.presionDiastolica);
            
            resumenFecha.textContent = ultimoRegistro.fecha;
            resumenPeso.textContent = ultimoRegistro.pesoActual !== null ? ultimoRegistro.pesoActual : '--';
            resumenIMC.textContent = imcUltimo || '--';
            resumenPresion.textContent = `
                ${ultimoRegistro.presionSistolica !== null ? ultimoRegistro.presionSistolica : '--'} / 
                ${ultimoRegistro.presionDiastolica !== null ? ultimoRegistro.presionDiastolica : '--'} mmHg 
                (${presionUltima})
            `;
        }
        renderizarGraficos(); 
    }

    function renderizarGraficos() { 
        const canvasPeso = document.getElementById('graficoPeso');
        const canvasPresion = document.getElementById('graficoPresion');
        const canvasIMC = document.getElementById('graficoIMC');
        const canvasHidratacion = document.getElementById('graficoHidratacion');

        if (!canvasPeso || !canvasPresion || !canvasIMC || !canvasHidratacion) {
             console.warn("Alguno de los elementos canvas para los gráficos no fue encontrado.");
             return;
        }

        if (graficoPesoChart) graficoPesoChart.destroy();
        if (graficoPresionChart) graficoPresionChart.destroy();
        if (graficoIMCChart) graficoIMCChart.destroy();
        if (graficoHidratacionChart) graficoHidratacionChart.destroy();
        
        if (registrosDiarios.length === 0) {
            return;
        }

        const datosOrdenados = [...registrosDiarios].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

        const fechas = datosOrdenados.map(d => new Date(d.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
        const pesos = datosOrdenados.map(d => d.pesoActual !== null ? d.pesoActual : NaN);
        const imcsData = datosOrdenados.map(d => calcularIMC(d.pesoActual, perfilUsuarioActual ? perfilUsuarioActual.altura : null));
        const aguas = datosOrdenados.map(d => d.hidratacion.aguaConsumidaML !== null ? d.hidratacion.aguaConsumidaML : NaN);
        const sistolicas = datosOrdenados.map(d => d.presionSistolica !== null ? d.presionSistolica : NaN);
        const diastolicas = datosOrdenados.map(d => d.presionDiastolica !== null ? d.presionDiastolica : NaN);

        graficoPesoChart = new Chart(canvasPeso.getContext('2d'), {
            type: 'line',
            data: { labels: fechas, datasets: [{ label: 'Peso (lbs)', data: pesos, borderColor: 'rgba(75, 192, 192, 1)', backgroundColor: 'rgba(75, 192, 192, 0.2)', fill: true, tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false }
        });

        graficoPresionChart = new Chart(canvasPresion.getContext('2d'), {
            type: 'line',
            data: {
                labels: fechas,
                datasets: [
                    { label: 'Sistólica (mmHg)', data: sistolicas, borderColor: 'rgba(255, 99, 132, 1)', fill: false, tension: 0.1 },
                    { label: 'Diastólica (mmHg)', data: diastolicas, borderColor: 'rgba(54, 162, 235, 1)', fill: false, tension: 0.1 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
        
        const validImcsParsed = imcsData.map(val => parseFloat(val)).filter(val => !isNaN(val));
        let imcScalesOptions = { y: { beginAtZero: false } };

        if (validImcsParsed.length > 0) {
            let minVal = Math.min(...validImcsParsed);
            let maxVal = Math.max(...validImcsParsed);
            imcScalesOptions.y.suggestedMin = minVal - 2;
            imcScalesOptions.y.suggestedMax = maxVal + 2;
            if (minVal === maxVal) { 
                imcScalesOptions.y.suggestedMin = minVal - 2;
                imcScalesOptions.y.suggestedMax = maxVal + 2;
            }
            if (imcScalesOptions.y.suggestedMin >= imcScalesOptions.y.suggestedMax) {
                imcScalesOptions.y.suggestedMax = imcScalesOptions.y.suggestedMin + 4; 
            }
        }

        graficoIMCChart = new Chart(canvasIMC.getContext('2d'), {
            type: 'line',
            data: {
                labels: fechas,
                datasets: [{
                    label: 'IMC',
                    data: imcsData.map(val => val === null ? NaN : parseFloat(val)),
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: imcScalesOptions
            }
        });

        graficoHidratacionChart = new Chart(canvasHidratacion.getContext('2d'), {
            type: 'bar',
            data: {
                labels: fechas,
                datasets: [{
                    label: 'Agua Consumida (mL)',
                    data: aguas,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.5)',
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // --- LÓGICA PARA PLAN DE DIETA ---
    function obtenerSugerenciaComida(categoriaDeseada, excluirNombre = null) {
        let recetasFiltradas = RECETAS_KETO_LIBRO.filter(
            receta => receta.categoria === categoriaDeseada && receta.nombre !== excluirNombre
        );
        if (recetasFiltradas.length === 0) {
            recetasFiltradas = RECETAS_KETO_LIBRO.filter(receta => receta.categoria === categoriaDeseada);
        }
        if (recetasFiltradas.length > 0) {
            const indiceAleatorio = Math.floor(Math.random() * recetasFiltradas.length);
            return recetasFiltradas[indiceAleatorio];
        }
        return { nombre: `Más opciones de ${categoriaDeseada} próximamente.`, fuentePagina: "", fuenteUrl: "" };
    }

    function crearHtmlSugerencia(sugerenciaObj) {
        if (!sugerenciaObj || !sugerenciaObj.nombre || sugerenciaObj.nombre.includes("próximamente")) {
            return sugerenciaObj.nombre || "No disponible";
        }
        return `${sugerenciaObj.nombre} <a href="${sugerenciaObj.fuenteUrl}" target="_blank" class="enlace-receta-libro" title="Abrir libro de recetas PDF (aprox. ${sugerenciaObj.fuentePagina})">(Ver en libro)</a>`;
    }

    function generarPlanDietaDiaSiguiente() {
        const desayunoSugeridoObj = obtenerSugerenciaComida("desayuno");
        const almuerzoSugeridoObj = obtenerSugerenciaComida("almuerzo");
        const cenaSugeridaObj = obtenerSugerenciaComida("cena");
        const snackSugerido1Obj = obtenerSugerenciaComida("snack");
        let snackSugerido2Obj = obtenerSugerenciaComida("snack", snackSugerido1Obj.nombre);
        if (snackSugerido1Obj.nombre === snackSugerido2Obj.nombre) {
            if (RECETAS_KETO_LIBRO.filter(r => r.categoria === "snack").length <= 1) {
                snackSugerido2Obj = { nombre: "(opcional, o repetir)", fuentePagina: "", fuenteUrl: "" };
            } else {
                 let intentoSnack2 = obtenerSugerenciaComida("snack", snackSugerido1Obj.nombre);
                 if(intentoSnack2.nombre !== snackSugerido1Obj.nombre) {
                    snackSugerido2Obj = intentoSnack2;
                 } else {
                    snackSugerido2Obj = { nombre: "(opcional, o repetir)", fuentePagina: "", fuenteUrl: "" };
                 }
            }
        }
        if(elSugerenciaDesayuno) elSugerenciaDesayuno.innerHTML = crearHtmlSugerencia(desayunoSugeridoObj);
        if(elSugerenciaAlmuerzo) elSugerenciaAlmuerzo.innerHTML = crearHtmlSugerencia(almuerzoSugeridoObj);
        if(elSugerenciaCena) elSugerenciaCena.innerHTML = crearHtmlSugerencia(cenaSugeridaObj);
        const snacksArray = [snackSugerido1Obj, snackSugerido2Obj].filter(s => s.nombre && !s.nombre.includes("próximamente") && !s.nombre.includes("(opcional, o repetir)"));
        let snacksHtml = "Opcional";
        if (snacksArray.length > 0) {
            snacksHtml = snacksArray.map(s => crearHtmlSugerencia(s)).join(" / ");
        }
        if(elSugerenciaSnacks) elSugerenciaSnacks.innerHTML = snacksHtml;
    }

    // --- LÓGICA PARA RUTINA DE EJERCICIO ---
    function obtenerSugerenciaRutina() {
        let indiceActual = parseInt(localStorage.getItem(KEY_INDICE_RUTINA_ACTUAL) || "0");
        const rutinaSugerida = RUTINAS_EJERCICIOS_CICLO[indiceActual % RUTINAS_EJERCICIOS_CICLO.length];
        localStorage.setItem(KEY_INDICE_RUTINA_ACTUAL, (indiceActual + 1).toString());
        return rutinaSugerida;
    }

    function mostrarRutinaSugerida() {
        const rutina = obtenerSugerenciaRutina();
        if (nombreRutinaDiv) {
            nombreRutinaDiv.textContent = rutina.nombreCiclo;
        }
        if (listaEjerciciosDiv) {
            listaEjerciciosDiv.innerHTML = ''; 
            rutina.ejerciciosPropuestos.forEach(ejercicioProp => {
                const ejercicioInfo = EJERCICIOS_LIBRO.find(e => e.nombre === ejercicioProp.nombreEjercicio);
                if (ejercicioInfo) {
                    const divEjercicio = document.createElement('div');
                    divEjercicio.className = 'ejercicio-sugerido';
                    divEjercicio.innerHTML = `
                        <h4>${ejercicioInfo.nombre} <a href="${ejercicioInfo.urlLibro}#page=${ejercicioInfo.pagina}" target="_blank" class="enlace-ejercicio-libro" title="Abrir libro de ejercicios PDF (página ${ejercicioInfo.pagina})">(Ver p. ${ejercicioInfo.pagina})</a></h4>
                        <p><strong>Grupo Muscular:</strong> ${ejercicioInfo.grupoMuscular}</p>
                        <p><strong>Sugerencia:</strong> ${ejercicioProp.seriesYRepeticiones}</p>
                        <p><strong>Ejecución:</strong> ${ejercicioInfo.descripcion}</p>
                    `;
                    listaEjerciciosDiv.appendChild(divEjercicio);
                } else {
                    const divEjercicio = document.createElement('div');
                    divEjercicio.className = 'ejercicio-sugerido';
                    divEjercicio.innerHTML = `<h4>${ejercicioProp.nombreEjercicio}</h4><p>${ejercicioProp.seriesYRepeticiones}</p><p>Descripción no encontrada.</p>`;
                    listaEjerciciosDiv.appendChild(divEjercicio);
                }
            });
        }
    }

    // --- FUNCIONES DE BACKUP Y RESTAURACIÓN ---
    function descargarBackup() {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-').replace("T", "_");
        const nombreArchivo = `backup_salud_fitness_${timestamp}.json`;
        const datosParaBackup = {
            perfilUsuario: perfilUsuarioActual,
            registrosDiarios: registrosDiarios
        };
        try {
            const jsonString = JSON.stringify(datosParaBackup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombreArchivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('Backup descargado exitosamente como: ' + nombreArchivo);
        } catch (error) {
            console.error("Error al crear el backup:", error);
            alert("Error al crear el backup. Revisa la consola para más detalles.");
        }
    }

    function manejarCargaBackup(event) {
        const archivo = event.target.files[0];
        if (!archivo) return;
        if (archivo.type !== "application/json") {
            alert("Por favor, selecciona un archivo .json válido para el backup.");
            event.target.value = null;
            return;
        }
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const contenido = e.target.result;
                const datosRestaurados = JSON.parse(contenido);
                if (datosRestaurados && typeof datosRestaurados.perfilUsuario === 'object' && Array.isArray(datosRestaurados.registrosDiarios)) {
                    if (!confirm("¿Estás seguro de que quieres restaurar los datos desde este archivo? Esto sobrescribirá tus datos actuales.")) {
                        event.target.value = null;
                        return;
                    }
                    perfilUsuarioActual = datosRestaurados.perfilUsuario;
                    registrosDiarios = datosRestaurados.registrosDiarios;
                    localStorage.setItem(PERFIL_STORAGE_KEY, JSON.stringify(perfilUsuarioActual));
                    localStorage.setItem(REGISTROS_DIARIOS_STORAGE_KEY, JSON.stringify(registrosDiarios));
                    alert('Backup restaurado exitosamente. La página se recargará para aplicar los cambios.');
                    location.reload();
                } else {
                    alert("El archivo de backup no tiene el formato esperado o está corrupto.");
                }
            } catch (error) {
                console.error("Error al leer o parsear el archivo de backup:", error);
                alert("Error al procesar el archivo de backup. Asegúrate de que sea un archivo JSON válido.");
            } finally {
                event.target.value = null;
            }
        };
        reader.onerror = function() {
            alert("Ocurrió un error al leer el archivo.");
            event.target.value = null;
        };
        reader.readAsText(archivo);
    }

    // --- INICIALIZACIÓN DE LA APLICACIÓN Y EVENT LISTENERS ---
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }
    
    // Listeners de formularios
    if (formPerfil) {
        formPerfil.addEventListener('submit', (event) => {
            event.preventDefault();
            guardarPerfil();
        });
    }
    if (formRegistroDiario) {
        formRegistroDiario.addEventListener('submit', (event) => {
            event.preventDefault();
            guardarRegistroDiario();
        });
    }

    // Listeners de botones de gestión y plan
    if (btnDescargarBackup) {
        btnDescargarBackup.addEventListener('click', descargarBackup);
    }
    if (inputArchivoBackup) {
        inputArchivoBackup.addEventListener('change', manejarCargaBackup);
    }
    if (btnGenerarNuevoPlan) {
        btnGenerarNuevoPlan.addEventListener('click', generarPlanDietaDiaSiguiente);
    }
    if (btnGenerarNuevaRutina) {
        btnGenerarNuevaRutina.addEventListener('click', mostrarRutinaSugerida);
    }
    
    // Carga inicial de datos y UI
    cargarPerfil();
    cargarRegistrosDiarios(); 
    setDefaultDate();
    generarPlanDietaDiaSiguiente(); 
    mostrarRutinaSugerida(); // Mostrar rutina inicial al cargar

}); // Fin de DOMContentLoaded