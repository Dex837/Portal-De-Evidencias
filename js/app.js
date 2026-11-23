import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

await setPersistence(auth, browserLocalPersistence);

// =====================================
// ESTADO Y NAVEGACIÓN
// =====================================

let datosUsuarioActual = null;
let registerInProgress = false;
let current = 0;
const screens = [...document.querySelectorAll(".screen")];

const cvData = {
  personal: {},
  academica: {},
  extracurricular: {},
  experiencia: {},
  proyectos: {},
  habilidades: {},
  intereses: {}
};

function goTo(index) {
  current = Math.max(0, Math.min(screens.length - 1, index));
  screens.forEach((screen, i) => screen.classList.toggle("active", i === current));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.getElementById("go-register").addEventListener("click", () => goTo(1));

function showMessage(elementId, message, success = false) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = message;
  element.style.color = success ? "green" : "red";
  element.style.margin = "12px 0";
}

// =====================================
// FIRESTORE: PERFIL
// =====================================

async function cargarDatosUsuario(user) {
  try {
    const referencia = doc(db, "users", user.uid);
    const documento = await getDoc(referencia);

    if (!documento.exists()) {
      console.warn("No existe un documento para este usuario.");
      return null;
    }

    const datos = documento.data();
    console.log("Datos del usuario recuperados:", datos);
    return datos;
  } catch (error) {
    console.error("Error al recuperar los datos:", error);
    return null;
  }
}

function mostrarDatosPerfil(datos) {
  if (!datos) return;
  document.getElementById("profile-name").value = datos.nombre || "";
  document.getElementById("profile-birthdate").value = datos.fechaNacimiento || "";
  document.getElementById("profile-email").value = datos.correo || "";
  document.getElementById("profile-username").value = datos.usuario || "";
}

// =====================================
// REGISTRO
// =====================================

const registerForm = document.getElementById("register-form");

registerForm.addEventListener("submit", async event => {
  event.preventDefault();

  const nombre = document.getElementById("register-name").value.trim();
  const fechaNacimiento = document.getElementById("register-birthdate").value;
  const correo = document.getElementById("register-email").value.trim().toLowerCase();
  const usuario = document.getElementById("register-username").value.trim();
  const password = document.getElementById("register-password").value;
  try {
    registerInProgress = true;
    showMessage("register-message", "Registrando usuario...", true);
    const credential = await createUserWithEmailAndPassword(auth, correo, password);
    const user = credential.user;
    await setDoc(doc(db, "users", user.uid), {
      nombre,
      fechaNacimiento,
      correo,
      usuario,
      createdAt: serverTimestamp()
    });

    datosUsuarioActual = { nombre, fechaNacimiento, correo, usuario };
    mostrarDatosPerfil(datosUsuarioActual);
    showMessage("register-message", "¡Cuenta registrada correctamente!", true);
    console.log("Usuario registrado:", user.uid);
    registerForm.reset();
    goTo(2);
  } catch (error) {
    console.error("Error al registrar:", error);
    let message = "No fue posible completar el registro.";
    switch (error.code) {
      case "auth/email-already-in-use": message = "Este correo electrónico ya está registrado."; break;
      case "auth/invalid-email": message = "El correo electrónico no es válido."; break;
      case "auth/weak-password": message = "La contraseña debe tener al menos 6 caracteres."; break;
      case "permission-denied":
      case "firestore/permission-denied": message = "No tienes permisos para guardar los datos en Firestore."; break;
    }
    showMessage("register-message", message);
  } finally {
    registerInProgress = false;
  }
});

// =====================================
// INICIO DE SESIÓN
// =====================================

const loginForm = document.getElementById("login-form");

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const correo = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-pass").value;

  try {
    showMessage("login-message", "Verificando credenciales...", true);
    const credential = await signInWithEmailAndPassword(auth, correo, password);
    console.log("Inicio de sesión correcto:", credential.user.uid);
    showMessage("login-message", "¡Bienvenido! Inicio de sesión correcto.", true);
    loginForm.reset();
    // onAuthStateChanged recupera el perfil y muestra la pantalla Perfil.
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    let message = "No fue posible iniciar sesión.";
    switch (error.code) {
      case "auth/invalid-credential": message = "Correo electrónico o contraseña incorrectos."; break;
      case "auth/invalid-email": message = "El correo electrónico no es válido."; break;
      case "auth/too-many-requests": message = "Demasiados intentos. Intenta más tarde."; break;
    }
    showMessage("login-message", message);
  }
});

// =====================================
// CERRAR SESIÓN
// =====================================

document.getElementById("logout-btn").addEventListener("click", async () => {
  if (!confirm("¿Estás seguro de que deseas cerrar sesión?")) return;

  try {
    await guardarTodosLosApartados();
    fotoCvDataUrl = null;
    if (photoInput) photoInput.value = "";
    if (photoStatus) photoStatus.textContent = "";
    await signOut(auth);
    datosUsuarioActual = null;
    Object.keys(cvData).forEach(key => cvData[key] = {});

    // Limpiar los datos temporales de los formularios y archivos.
    document.querySelectorAll(".screen input, .screen textarea, .screen select").forEach(field => {
      if (["login-email", "login-pass", "register-name", "register-birthdate", "register-email",
           "register-username", "register-password", "profile-name", "profile-birthdate",
           "profile-email", "profile-username"].includes(field.id)) return;

      if (field.type === "file") field.value = "";
      else if (field.tagName === "SELECT") field.selectedIndex = 0;
      else field.value = "";
    });

    closeCvModal();
    // El observador detectará signOut y regresará al inicio de sesión.
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    alert("No fue posible cerrar la sesión. Intenta nuevamente.");
  }
});

// =====================================
// SELECTOR DE APARTADOS Y MODALES
// =====================================

const sectionConfig = [
  { index: 3, key: "academica", title: "Formación académica" },
  { index: 4, key: "extracurricular", title: "Formación extracurricular" },
  { index: 5, key: "experiencia", title: "Experiencia laboral" },
  { index: 6, key: "proyectos", title: "Proyectos / Prácticas" },
  { index: 7, key: "habilidades", title: "Habilidades" },
  { index: 8, key: "intereses", title: "Intereses" }
];

// =====================================
// FIRESTORE: GUARDAR Y RECUPERAR APARTADOS DEL CV
// =====================================

const saveTimers = new Map();
const saveStatusElements = new Map();

function obtenerCamposApartado(section) {
  const fields = {};
  screens[section.index].querySelectorAll("[data-field]").forEach(field => {
    // Los archivos nunca se incluyen en los datos enviados a Firestore.
    if (field.type === "file") return;
    fields[field.dataset.field] = field.value;
  });
  return fields;
}

function obtenerIntereses() {
  const field = document.querySelector('[data-field="interesesTexto"]');
  if (!field) return [];

  // Acepta intereses separados por comas o por saltos de línea.
  return field.value
    .split(/[\n,;]+/)
    .map(value => value.trim())
    .filter(Boolean);
}

function actualizarEstadoGuardado(section, message, isError = false) {
  const status = saveStatusElements.get(section.key);
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("save-error", isError);
  status.classList.toggle("save-success", !isError && message.includes("guard"));
}

function crearEstadosGuardado() {
  sectionConfig.forEach(section => {
    const status = document.createElement("p");
    status.className = "save-status";
    status.setAttribute("aria-live", "polite");
    status.textContent = "Los cambios se guardan automáticamente.";
    screens[section.index].append(status);
    saveStatusElements.set(section.key, status);
  });
}

async function guardarApartado(section) {
  const user = auth.currentUser;
  if (!user) return;

  const fields = obtenerCamposApartado(section);
  const data = {
    fields,
    updatedAt: serverTimestamp()
  };

  if (section.key === "intereses") {
    data.intereses = obtenerIntereses();
  }

  try {
    actualizarEstadoGuardado(section, "Guardando cambios...");
    const reference = doc(db, "users", user.uid, "cvSections", section.key);
    await setDoc(reference, data, { merge: true });
    cvData[section.key] = section.key === "intereses"
      ? { ...fields, intereses: data.intereses }
      : fields;
    actualizarEstadoGuardado(section, "Cambios guardados en la nube.");
  } catch (error) {
    console.error(`Error al guardar ${section.title}:`, error);
    actualizarEstadoGuardado(section, "No se pudieron guardar los cambios. Revisa tu conexión o permisos.", true);
  }
}

function programarGuardado(section) {
  const previousTimer = saveTimers.get(section.key);
  if (previousTimer) clearTimeout(previousTimer);

  actualizarEstadoGuardado(section, "Cambios pendientes de guardar...");
  const timer = setTimeout(() => {
    saveTimers.delete(section.key);
    guardarApartado(section);
  }, 700);
  saveTimers.set(section.key, timer);
}

async function guardarApartadosPendientes() {
  const pending = [];
  for (const section of sectionConfig) {
    const timer = saveTimers.get(section.key);
    if (timer) {
      clearTimeout(timer);
      saveTimers.delete(section.key);
      pending.push(guardarApartado(section));
    }
  }
  await Promise.all(pending);
}

async function guardarTodosLosApartados() {
  await guardarApartadosPendientes();
  // Asegura que el último estado visible de cada apartado quede persistido.
  await Promise.all(sectionConfig.map(section => guardarApartado(section)));
}

async function cargarApartadosUsuario(user) {
  for (const section of sectionConfig) {
    try {
      const reference = doc(db, "users", user.uid, "cvSections", section.key);
      const snapshot = await getDoc(reference);
      if (!snapshot.exists()) continue;

      const saved = snapshot.data();
      const fields = saved.fields || {};
      cvData[section.key] = { ...fields };

      Object.entries(fields).forEach(([key, value]) => {
        const field = screens[section.index].querySelector(`[data-field="${CSS.escape(key)}"]`);
        if (field && field.type !== "file") field.value = value ?? "";
      });

      if (section.key === "intereses") {
        // Compatibilidad con los intereses guardados anteriormente como etiquetas.
        const interestField = screens[section.index].querySelector('[data-field="interesesTexto"]');
        if (interestField && !interestField.value && Array.isArray(saved.intereses)) {
          interestField.value = saved.intereses.join("\n");
        }
        cvData.intereses.intereses = obtenerIntereses();
      }

      actualizarEstadoGuardado(section, "Información recuperada.");
    } catch (error) {
      console.error(`Error al recuperar ${section.title}:`, error);
      actualizarEstadoGuardado(section, "No se pudo recuperar este apartado.", true);
    }
  }
}

crearEstadosGuardado();

sectionConfig.forEach(section => {
  const screen = screens[section.index];
  screen.querySelectorAll("[data-field]").forEach(field => {
    if (field.type === "file") return;
    field.addEventListener("input", () => programarGuardado(section));
    field.addEventListener("change", () => programarGuardado(section));
  });
});

const modalBackdrop = document.getElementById("cv-modal-backdrop");
const modalTitle = document.getElementById("cv-modal-title");
const modalDescription = document.getElementById("cv-modal-description");
const modalContent = document.getElementById("cv-modal-content");
const modalActions = document.getElementById("cv-modal-actions");

function openCvModal() {
  modalBackdrop.hidden = false;
  document.body.classList.add("modal-open");
}

function closeCvModal() {
  modalBackdrop.hidden = true;
  document.body.classList.remove("modal-open");
}

document.getElementById("cv-modal-close").addEventListener("click", closeCvModal);
modalBackdrop.addEventListener("click", event => {
  if (event.target === modalBackdrop) closeCvModal();
});

function getSectionFields(section) {
  return [...screens[section.index].querySelectorAll("input:not([type='file']), textarea, select")];
}

function fieldHasValue(field) {
  return field.value.trim() !== "" &&
    !(field.tagName === "SELECT" && field.selectedIndex === 0);
}

function sectionHasContent(section) {
  const screen = screens[section.index];
  const hasText = getSectionFields(section).some(fieldHasValue);
  const hasFile = [...screen.querySelectorAll("input[type='file']")]
    .some(input => input.files && input.files.length > 0);
  const hasInterest = section.key === "intereses" && obtenerIntereses().length > 0;
  return hasText || hasFile || hasInterest;
}

function sectionStatus(section) {
  return sectionHasContent(section) ? "Con información" : "Pendiente";
}

function abrirSelector() {
  modalTitle.textContent = "Continúa construyendo tu CV";
  modalDescription.textContent = "Selecciona el apartado que deseas completar. Puedes avanzar en el orden que prefieras.";
  modalContent.replaceChildren();
  modalActions.replaceChildren();

  const list = document.createElement("div");
  list.className = "section-picker-list";

  sectionConfig.forEach(section => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-picker-item";

    const info = document.createElement("span");
    info.className = "section-picker-info";

    const name = document.createElement("strong");
    name.textContent = section.title;

    const status = document.createElement("small");
    status.textContent = sectionStatus(section);

    info.append(name, status);

    const arrow = document.createElement("span");
    arrow.className = "section-picker-arrow";
    arrow.textContent = "›";

    button.append(info, arrow);
    button.addEventListener("click", () => mostrarDetalleApartado(section));
    list.append(button);
  });

  modalContent.append(list);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "secondary-button";
  closeButton.textContent = "Cerrar";
  closeButton.addEventListener("click", closeCvModal);
  modalActions.append(closeButton);

  openCvModal();
}

function mostrarDetalleApartado(section) {
  modalTitle.textContent = section.title;
  modalDescription.textContent = "Esta es la información que todavía puedes completar. Los archivos adjuntos son opcionales.";
  modalContent.replaceChildren();
  modalActions.replaceChildren();

  const missing = getSectionFields(section).filter(field => !fieldHasValue(field));
  const list = document.createElement("ul");
  list.className = "missing-fields";

  if (missing.length === 0) {
    const item = document.createElement("li");
    item.textContent = "Los campos de texto disponibles ya tienen información.";
    list.append(item);
  } else {
    missing.forEach(field => {
      const item = document.createElement("li");
      const label = field.closest(".field")?.querySelector("label");
      item.textContent = label?.textContent.trim() || field.placeholder || "Campo sin completar";
      list.append(item);
    });
  }

  const fileCount = screens[section.index].querySelectorAll("input[type='file']").length;
  modalContent.append(list);

  if (fileCount > 0) {
    const note = document.createElement("p");
    note.className = "modal-note";
    note.textContent = `${fileCount} campo(s) para adjuntar archivos. Son opcionales; los archivos se usarán localmente y no se guardarán en Firestore.`;
    modalContent.append(note);
  }

  const back = document.createElement("button");
  back.type = "button";
  back.className = "secondary-button";
  back.textContent = "Volver a apartados";
  back.addEventListener("click", abrirSelector);

  const open = document.createElement("button");
  open.type = "button";
  open.className = "primary modal-primary";
  open.textContent = "Abrir apartado";
  open.addEventListener("click", () => {
    closeCvModal();
    goTo(section.index);
  });

  modalActions.append(back, open);
}

document.getElementById("continue-cv-btn").addEventListener("click", abrirSelector);

// =====================================
// VALIDACIÓN Y BOTONES SIGUIENTE
// =====================================

function confirmarSaltar(section, nextIndex) {
  const answer = confirm(
    `No has ingresado información en ${section.title}. ¿Estás seguro de que deseas continuar sin completar este apartado?`
  );
  if (answer) goTo(nextIndex);
}

sectionConfig.forEach((section, position) => {
  const nav = document.createElement("div");
  nav.className = "section-navigation";

  const picker = document.createElement("button");
  picker.type = "button";
  picker.className = "secondary-button";
  picker.textContent = "Apartados";
  picker.addEventListener("click", abrirSelector);

  const next = document.createElement("button");
  next.type = "button";
  next.className = "primary";
  next.textContent = position === sectionConfig.length - 1 ? "Finalizar" : "Siguiente";

  next.addEventListener("click", async () => {
    const nextSection = sectionConfig[position + 1];

    if (!sectionHasContent(section)) {
      if (nextSection) confirmarSaltar(section, nextSection.index);
      else if (confirm(`No has ingresado información en ${section.title}. ¿Deseas regresar al selector?`)) abrirSelector();
      return;
    }

    if (nextSection) {
      const timer = saveTimers.get(section.key);
      if (timer) {
        clearTimeout(timer);
        saveTimers.delete(section.key);
      }
      await guardarApartado(section);
      goTo(nextSection.index);
    } else {
      const completed = sectionConfig.filter(sectionHasContent);
      if (completed.length < 1) {
        alert("Para continuar con tu CV, completa al menos un apartado.");
        return;
      }
      await guardarTodosLosApartados();
      alert(`¡Muy bien! Tienes ${completed.length} apartado(s) con información. Puedes seguir editándolos desde el selector.`);
      abrirSelector();
    }
  });

  nav.append(picker, next);
  screens[section.index].append(nav);
});

document.getElementById("finish-cv-btn").addEventListener("click", async () => {
  const completed = sectionConfig.filter(sectionHasContent);
  if (completed.length === 0) {
    alert("Para continuar con tu CV, completa al menos un apartado.");
    return;
  }
  await guardarTodosLosApartados();
  alert(`Tus cambios están guardados. Tienes ${completed.length} apartado(s) con información. Ya puedes generar tu CV en PDF con el botón "Generar / Descargar CV en PDF".`);
});

// =====================================
// GENERAR CV E IMPRIMIR / GUARDAR COMO PDF
// =====================================

const printContainer = document.getElementById("cv-print");
const photoInput = document.getElementById("cv-photo-input");
const photoStatus = document.getElementById("cv-photo-status");
let fotoCvDataUrl = null; // Solo memoria local: nunca se envía a Firestore.

photoInput?.addEventListener("change", () => {
  const file = photoInput.files?.[0];
  fotoCvDataUrl = null;

  if (!file) {
    photoStatus.textContent = "No se seleccionó fotografía.";
    return;
  }

  if (!file.type.startsWith("image/")) {
    photoInput.value = "";
    photoStatus.textContent = "Selecciona una imagen JPG, PNG o WebP.";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    photoInput.value = "";
    photoStatus.textContent = "La fotografía supera el límite de 5 MB.";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    fotoCvDataUrl = typeof reader.result === "string" ? reader.result : null;
    photoStatus.textContent = fotoCvDataUrl
      ? `Fotografía lista: ${file.name}. Solo se usará para este CV.`
      : "No se pudo leer la fotografía.";
  };
  reader.onerror = () => {
    fotoCvDataUrl = null;
    photoStatus.textContent = "No se pudo leer la fotografía.";
  };
  reader.readAsDataURL(file);
});

function obtenerValorCV(fieldKey) {
  const field = document.querySelector(`[data-field="${CSS.escape(fieldKey)}"]`);
  if (!field || field.type === "file") return "";
  if (field.tagName === "SELECT" && field.selectedIndex === 0) return "";
  return (field.value || "").trim();
}

function agregarEntradaCV(contenedor, titulo, detalle = "", descripcion = "") {
  if (![titulo, detalle, descripcion].some(value => value && value.trim())) return;

  const entry = document.createElement("article");
  entry.className = "cv-print-entry";

  if (titulo) {
    const heading = document.createElement("h3");
    heading.textContent = titulo;
    entry.append(heading);
  }
  if (detalle) {
    const meta = document.createElement("p");
    meta.className = "cv-print-meta";
    meta.textContent = detalle;
    entry.append(meta);
  }
  if (descripcion) {
    const text = document.createElement("p");
    text.className = "cv-print-description";
    text.textContent = descripcion;
    entry.append(text);
  }
  contenedor.append(entry);
}

function crearSeccionCV(titulo, construir) {
  const section = document.createElement("section");
  section.className = "cv-print-section";
  const heading = document.createElement("h2");
  heading.textContent = titulo;
  section.append(heading);

  const content = document.createElement("div");
  content.className = "cv-print-section-content";
  construir(content);
  if (!content.childElementCount) return null;
  section.append(content);
  return section;
}

function construirContenidoCV() {
  const name = (datosUsuarioActual?.nombre || "").trim();
  const email = (datosUsuarioActual?.correo || auth.currentUser?.email || "").trim();
  const sections = [];

  const academic = crearSeccionCV("Formación académica", content => {
    const school = obtenerValorCV("preparatoriaInstitucion");
    const schoolPeriod = obtenerValorCV("preparatoriaPeriodo");
    agregarEntradaCV(content, school, schoolPeriod ? `Preparatoria · ${schoolPeriod}` : "Preparatoria");

    const university = obtenerValorCV("universidadInstitucion");
    const level = obtenerValorCV("universidadNivel");
    const period = obtenerValorCV("universidadPeriodo");
    const detail = [level, period].filter(Boolean).join(" · ");
    agregarEntradaCV(content, university, detail || "Universidad");
  });
  if (academic) sections.push(academic);

  const extracurricular = crearSeccionCV("Formación extracurricular", content => {
    [
      ["Cursos", obtenerValorCV("cursos")],
      ["Congresos", obtenerValorCV("congresos")],
      ["Conferencias", obtenerValorCV("conferencias")]
    ].forEach(([label, value]) => agregarEntradaCV(content, label, "", value));
  });
  if (extracurricular) sections.push(extracurricular);

  const experience = crearSeccionCV("Experiencia laboral", content => {
    const company = obtenerValorCV("empresa");
    const role = obtenerValorCV("puestoRol");
    const period = obtenerValorCV("periodoTrabajo");
    const title = [role, company].filter(Boolean).join(" · ");
    agregarEntradaCV(content, title, period);
  });
  if (experience) sections.push(experience);

  const projects = crearSeccionCV("Proyectos y prácticas", content => {
    agregarEntradaCV(
      content,
      obtenerValorCV("practicaRealizada"),
      "",
      obtenerValorCV("descripcionPractica")
    );
  });
  if (projects) sections.push(projects);

  // Cada tipo de habilidad conserva su subtítulo y se muestra como lista con viñetas.
  function agregarListaHabilidades(contenedor, titulo, valor) {
    if (!valor.trim()) return;

    const entry = document.createElement("article");
    entry.className = "cv-print-entry cv-print-skill-entry";

    const heading = document.createElement("h3");
    heading.textContent = titulo;
    entry.append(heading);

    const list = document.createElement("ul");
    list.className = "cv-print-skill-list";

    // Acepta habilidades separadas por saltos de línea, comas o punto y coma.
    // Las líneas que terminan en dos puntos se conservan como subtítulos de categoría.
    valor.split(/\r?\n/).forEach(line => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      if (cleanLine.endsWith(":")) {
        const category = document.createElement("li");
        category.className = "cv-print-skill-category";
        category.textContent = cleanLine;
        list.append(category);
        return;
      }

      cleanLine.split(/[;,]/).forEach(item => {
        const skill = item.trim();
        if (!skill) return;
        const li = document.createElement("li");
        li.textContent = skill;
        list.append(li);
      });
    });

    if (list.childElementCount) {
      entry.append(list);
      contenedor.append(entry);
    }
  }

  const skills = crearSeccionCV("Habilidades", content => {
    agregarListaHabilidades(content, "Habilidades técnicas", obtenerValorCV("habilidadesTecnicas"));
    agregarListaHabilidades(content, "Habilidades interpersonales", obtenerValorCV("habilidadesBlandas"));
  });
  if (skills) sections.push(skills);

  const interests = crearSeccionCV("Intereses profesionales", content => {
    const selected = obtenerIntereses();
    if (selected.length) agregarEntradaCV(content, "", "", selected.join(" · "));
  });
  if (interests) sections.push(interests);

  return { name, email, sections };
}

async function generarCV() {
  if (!auth.currentUser) {
    alert("Inicia sesión para generar tu CV.");
    return;
  }

  const button = document.getElementById("download-cv-btn");
  button.disabled = true;
  button.textContent = "Preparando CV...";

  try {
    await guardarTodosLosApartados();
    const { name, email, sections } = construirContenidoCV();

    if (!sections.length) {
      alert("No hay información suficiente para generar el CV. Completa al menos un apartado con texto.");
      return;
    }

    printContainer.replaceChildren();
    printContainer.setAttribute("aria-hidden", "false");

    const header = document.createElement("header");
    header.className = "cv-print-header";

    if (fotoCvDataUrl) {
      const photo = document.createElement("img");
      photo.className = "cv-print-photo";
      photo.src = fotoCvDataUrl;
      photo.alt = "Fotografía de perfil";
      header.append(photo);
    }

    const identity = document.createElement("div");
    identity.className = "cv-print-identity";
    const heading = document.createElement("h1");
    heading.textContent = name || "Currículum Vitae";
    identity.append(heading);

    if (email) {
      const contact = document.createElement("p");
      contact.className = "cv-print-contact";
      contact.textContent = email;
      identity.append(contact);
    }

    header.append(identity);
    printContainer.append(header, ...sections);

    const previousTitle = document.title;

    // Evita que el nombre del documento aparezca en el encabezado de impresión.
    document.title = "";

    // El navegador ajusta el contenido; no se fuerza una sola página si afecta la legibilidad.
    const restaurarVista = () => {
      document.title = previousTitle;
      printContainer.setAttribute("aria-hidden", "true");
      window.removeEventListener("afterprint", restaurarVista);
    };
    window.addEventListener("afterprint", restaurarVista, { once: true });

    requestAnimationFrame(() => window.print());
  } catch (error) {
    console.error("Error al preparar el CV:", error);
    alert("No se pudo preparar el CV. Comprueba tu conexión y vuelve a intentarlo.");
  } finally {
    button.disabled = false;
    button.textContent = "Generar / Descargar CV en PDF";
  }
}

document.getElementById("download-cv-btn").addEventListener("click", generarCV);

// =====================================
// AUTENTICACIÓN: SESIÓN PERSISTENTE
// =====================================

onAuthStateChanged(auth, async user => {
  if (registerInProgress) return;

  if (user) {
    console.log("Usuario con sesión activa:", user.uid);
    datosUsuarioActual = await cargarDatosUsuario(user);

    if (datosUsuarioActual) {
      mostrarDatosPerfil(datosUsuarioActual);
      await cargarApartadosUsuario(user);
      console.log("Perfil y apartados del CV cargados correctamente.");
      goTo(2);
    } else {
      console.warn("No se pudieron cargar los datos del perfil.");
      goTo(0);
    }
  } else {
    console.log("No hay una sesión activa.");
    datosUsuarioActual = null;
    goTo(0);
  }
});

// Funciones invocadas desde onclick del HTML.
Object.assign(window, { goTo });
