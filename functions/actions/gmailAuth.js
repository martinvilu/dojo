const fetch = require('node-fetch');

// Environment variables or fallback credentials
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || "MOCK_CLIENT_ID.apps.googleusercontent.com";
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || "MOCK_CLIENT_SECRET";

async function getGmailAuthUrl(payload, context) {
    const { uid } = context;
    const redirectUri = payload.redirectUri || "http://localhost:3000/dashboard";
    const state = Buffer.from(JSON.stringify({ uid, redirectUri })).toString('base64');

    const scopes = [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/userinfo.email"
    ].join(" ");

    const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GMAIL_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(state)}`;

    return { authUrl: url };
}

async function saveGmailAuthCode(payload, context) {
    const { uid, db, admin } = context;
    const { code, redirectUri } = payload;
    if (!code) throw new Error("Código OAuth no proporcionado");

    const rUri = redirectUri || "http://localhost:3000/dashboard";

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code: code,
            client_id: GMAIL_CLIENT_ID,
            client_secret: GMAIL_CLIENT_SECRET,
            redirect_uri: rUri,
            grant_type: "authorization_code"
        })
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
        throw new Error(`Error en autorización Google: ${tokens.error_description || tokens.error}`);
    }

    // Get user email from userinfo endpoint
    let email = "docente@gmail.com";
    if (tokens.access_token) {
        try {
            const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
                headers: { Authorization: `Bearer ${tokens.access_token}` }
            });
            const userInfo = await userInfoRes.json();
            if (userInfo.email) email = userInfo.email;
        } catch (e) {
            console.error("Error al obtener email de usuario Gmail:", e);
        }
    }

    // Save tokens in Firestore
    await db.collection("gmail_credentials").doc(uid).set({
        teacher_id: uid,
        email: email,
        refresh_token: tokens.refresh_token || null,
        access_token: tokens.access_token || null,
        expires_at: Date.now() + ((tokens.expires_in || 3600) * 1000),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true, email: email };
}

async function getGmailAuthStatus(payload, context) {
    const { uid, db } = context;
    const doc = await db.collection("gmail_credentials").doc(uid).get();
    if (!doc.exists) {
        return { connected: false, email: null };
    }
    const data = doc.data();
    return {
        connected: true,
        email: data.email || null,
        updated_at: data.updated_at || null
    };
}

async function disconnectGmailAuth(payload, context) {
    const { uid, db } = context;
    await db.collection("gmail_credentials").doc(uid).delete();
    return { success: true };
}

async function sendGmailNotification(payload, context) {
    const { uid, db } = context;
    const { to, subject, htmlBody } = payload;

    if (!to || !subject || !htmlBody) {
        throw new Error("Parámetros 'to', 'subject' y 'htmlBody' requeridos.");
    }

    const doc = await db.collection("gmail_credentials").doc(uid).get();
    if (!doc.exists) {
        throw new Error("No has vinculado tu cuenta de Gmail para enviar notificaciones.");
    }

    const creds = doc.data();
    let accessToken = creds.access_token;

    // Refresh access token if expired
    if (!accessToken || Date.now() >= (creds.expires_at - 60000)) {
        if (!creds.refresh_token) {
            throw new Error("El permiso de Gmail venció. Por favor vuelve a vincular tu cuenta.");
        }

        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: GMAIL_CLIENT_ID,
                client_secret: GMAIL_CLIENT_SECRET,
                refresh_token: creds.refresh_token,
                grant_type: "refresh_token"
            })
        });

        const newTokens = await refreshRes.json();
        if (newTokens.error) {
            throw new Error(`Error al renovar token de Gmail: ${newTokens.error_description || newTokens.error}`);
        }

        accessToken = newTokens.access_token;
        await db.collection("gmail_credentials").doc(uid).update({
            access_token: accessToken,
            expires_at: Date.now() + ((newTokens.expires_in || 3600) * 1000)
        });
    }

    // Build RFC 2822 MIME message
    const rawMessage = [
        `From: Cátedra Dojo <${creds.email}>`,
        `To: ${to}`,
        `Subject: =?utf-8?B?${Buffer.from(subject).toString('base64')}?=`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        "",
        htmlBody
    ].join("\r\n");

    const base64UrlMessage = Buffer.from(rawMessage)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

    // Send via Gmail API
    const sendRes = await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: base64UrlMessage })
    });

    const sendData = await sendRes.json();
    if (sendData.error) {
        throw new Error(`Error al enviar mail por Gmail API: ${sendData.error.message || JSON.stringify(sendData.error)}`);
    }

    return { success: true, messageId: sendData.id, emailSentFrom: creds.email };
}

module.exports = {
    getGmailAuthUrl,
    saveGmailAuthCode,
    getGmailAuthStatus,
    disconnectGmailAuth,
    sendGmailNotification
};
