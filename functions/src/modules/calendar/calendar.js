const logger = require("firebase-functions/logger");
const { getFirestore } = require("firebase-admin/firestore");

exports.calendar = async (req, res) => {
    const courseId = req.query.id;
    if (!courseId) return res.status(400).send('Falta el ID del curso');
    
    const db = getFirestore();

    try {
        const cSnap = await db.collection('courses').doc(courseId).get();
        if (!cSnap.exists) return res.status(404).send('Curso no encontrado');
        
        const course = cSnap.data();
        
        let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jutsu Classroom//ES\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:" + (course.name || "Cursada") + "\r\n";
        
        if (course.class_instances && course.class_instances.length > 0) {
            course.class_instances.forEach((ci, idx) => {
                if (ci.special_status === 'Feriado') return;
                
                const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                
                const startDt = new Date(ci.date);
                const endDt = new Date(startDt.getTime() + 2 * 3600000);
                
                let title = `${course.name} - ${ci.type}`;
                if (ci.special_status === 'Examen') title = `[EXAMEN] ${title}`;
                if (ci.special_status === 'Clase Remota') title = `[REMOTA] ${title}`;
                
                let desc = ci.topic ? `Tema: ${ci.topic}\\n` : "";
                if (ci.presentation_url) desc += `Presentación: ${ci.presentation_url}\\n`;
                if (ci.recording_url) desc += `Grabación: ${ci.recording_url}\\n`;

                ics += "BEGIN:VEVENT\r\n";
                ics += `UID:course_${courseId}_ci_${idx}@jutsu.classroom\r\n`;
                ics += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
                ics += `DTSTART:${formatICSDate(startDt)}\r\n`;
                ics += `DTEND:${formatICSDate(endDt)}\r\n`;
                ics += `SUMMARY:${title}\r\n`;
                if (desc) ics += `DESCRIPTION:${desc}\r\n`;
                ics += "END:VEVENT\r\n";
            });
        } else if (course.start_date && course.duration_weeks && course.schedules) {
            const startStr = course.start_date;
            const [y, m, d] = startStr.split('-').map(Number);
            const baseDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
            
            const dayMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
            const rruleDayMap = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };

            course.schedules.forEach((sch, idx) => {
                const targetDay = dayMap[sch.day];
                if (targetDay === undefined) return;
                
                let currentDay = baseDate.getUTCDay();
                let diff = targetDay - currentDay;
                if (diff < 0) diff += 7;
                
                const firstClassDate = new Date(baseDate.getTime() + diff * 86400000);
                
                const [hh, mm] = (sch.time || "00:00").split(':').map(Number);
                firstClassDate.setUTCHours(hh, mm, 0);
                
                const endDate = new Date(firstClassDate.getTime() + 2 * 3600000);

                const formatICSDate = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

                ics += "BEGIN:VEVENT\r\n";
                ics += `UID:course_${courseId}_sch_${idx}@jutsu.classroom\r\n`;
                ics += `DTSTAMP:${formatICSDate(new Date())}\r\n`;
                ics += `DTSTART:${formatICSDate(firstClassDate)}\r\n`;
                ics += `DTEND:${formatICSDate(endDate)}\r\n`;
                ics += `RRULE:FREQ=WEEKLY;COUNT=${course.duration_weeks};BYDAY=${rruleDayMap[targetDay]}\r\n`;
                ics += `SUMMARY:${course.name} - ${sch.type}\r\n`;
                ics += `DESCRIPTION:Clase ${sch.type} de ${course.name}\r\n`;
                ics += "END:VEVENT\r\n";
            });
        }
        
        if (course.external_calendars && course.external_calendars.length > 0) {
            for (let url of course.external_calendars) {
                try {
                    const fetch = require('node-fetch');
                    const response = await fetch(url);
                    if (response.ok) {
                        const externalIcs = await response.text();
                        const vevents = externalIcs.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/gi);
                        if (vevents) {
                            vevents.forEach(ev => {
                                ics += ev + "\r\n";
                            });
                        }
                    }
                } catch (err) {
                    logger.error("Error fetching external calendar:", url, err);
                }
            }
        }
        
        ics += "END:VCALENDAR\r\n";
        
        res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="cursada_${courseId}.ics"`,
            'Access-Control-Allow-Origin': '*'
        });
        res.send(ics);
    } catch (e) {
        res.status(500).send(e.message);
    }
};
