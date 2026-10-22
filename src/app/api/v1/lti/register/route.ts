import { FieldValue } from "firebase-admin/firestore";
import { logger } from "@/lib/logger";
import { baseUrlFor, htmlError, htmlPage, ltiDeps } from "@/lib/lti/server";
import { registerWithPlatform, CLOSE_REGISTRATION_SCRIPT } from "../../../../../../functions/src/lib/lti/registration";
import { platformDocId } from "../../../../../../functions/src/lib/lti/launch";
import { isSafeExternalUrl } from "../../../../../../functions/src/lib/urls";

export const dynamic = "force-dynamic";

/**
 * LTI Dynamic Registration 1.0. El docente genera la URL (con `rt`, un token
 * de un solo uso atado a su cátedra) en Ajustes Cátedra → Integraciones y la
 * pega en Moodle; Moodle agrega openid_configuration y registration_token.
 *
 * La plataforma queda `pending` hasta que un administrador la aprueba.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const rt = params.get("rt");
  const openidConfigurationUrl = params.get("openid_configuration");
  if (!rt || !openidConfigurationUrl) {
    return htmlError("Esta URL se usa desde Moodle (Administración del sitio → Herramientas externas → Registrar por URL).");
  }

  const { db } = ltiDeps();
  const tokenRef = db.collection("lti_registrations").doc(rt);
  const tokenData = await db.runTransaction(async (tx) => {
    const snap = await tx.get(tokenRef);
    if (!snap.exists) return null;
    tx.delete(tokenRef);
    return snap.data();
  });
  const expires = tokenData?.expires_at?.toMillis ? tokenData.expires_at.toMillis() : 0;
  if (!tokenData || expires < Date.now()) {
    return htmlError("La URL de registro venció o ya fue usada. Generá una nueva desde Ajustes Cátedra.");
  }

  try {
    const registered = await registerWithPlatform({
      openidConfigurationUrl,
      registrationToken: params.get("registration_token") || "",
      baseUrl: baseUrlFor(request),
      courseId: tokenData.course_id,
      isSafeUrl: isSafeExternalUrl,
    });
    const id = platformDocId(registered.issuer, registered.client_id);
    const ref = db.collection("lti_platforms").doc(id);
    const existing = await ref.get();
    await ref.set({
      ...registered,
      deployment_ids: FieldValue.arrayUnion(...registered.deployment_ids),
      course_ids: FieldValue.arrayUnion(tokenData.course_id),
      owner_uid: existing.exists ? existing.data()?.owner_uid : tokenData.owner_uid,
      status: existing.exists ? existing.data()?.status : "pending",
      registered_via: "dynamic",
      updated_at: FieldValue.serverTimestamp(),
      ...(existing.exists ? {} : { created_at: FieldValue.serverTimestamp() }),
    }, { merge: true });
    await db.collection("audit_logs").add({
      action: "lti_platform_registered",
      course_id: tokenData.course_id,
      actor_id: tokenData.owner_uid,
      platform_id: id,
      issuer: registered.issuer,
      created_at: FieldValue.serverTimestamp(),
    });
    return htmlPage("Registro completado",
      `<h1 style="font-size:20px">✅ Ninja Dojo quedó registrado</h1>
<p style="color:#d4d4d4">Un administrador del Dojo tiene que aprobar la integración antes de que ingresen docentes o se vinculen cuentas existentes. Los estudiantes ya pueden entrar, con la inscripción pendiente.</p>
<script>${CLOSE_REGISTRATION_SCRIPT}</script>`);
  } catch (error: any) {
    logger.warn("[LTI] registro dinámico falló", { code: error?.code, message: error?.message });
    return htmlError(error?.message || "No se pudo completar el registro.");
  }
}
