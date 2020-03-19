const axios = require('axios')
const dateFns = require('date-fns')
const fs = require('fs')
const config = JSON.parse(fs.readFileSync(process.argv[2] == null ? 'config.json' : process.argv[2]))
const { Webhook, MessageBuilder } = require('webhook-discord')

const hook = new Webhook(config.webhookUrl)

function loadCalendar () {
	axios.get(config.pronoteCalendarUrl).then(response => {
		let events = response.data.match(/(BEGIN:VEVENT(.+?)END:VEVENT)/sg)
		let courses = events.map(course => {
			let dateStart = /^DTSTART.*:(.+)$/gm.exec(course)
			let dateEnd = /^DTEND.*:(.+)$/gm.exec(course)
			let summary = /^SUMMARY.*:(.+?) - (.+?)( - (.+))?$/gm.exec(course)
			let room = /^LOCATION.*:(.+)$/gm.exec(course)
			if (summary === null) summary = []
			let [,subject,teacher,,group] = summary
			return {
				dateStart: dateStart === null ? new Date(0) : dateFns.parseISO(dateStart[1]),
				dateEnd: dateEnd === null ? new Date(0) : dateFns.parseISO(dateEnd[1]),
				subject: subject,
				teacher: teacher,
				group,
				room: room === null ? undefined : room[1]
			}
		})
		let course = courses.filter(course => dateFns.isFuture(course.dateStart) && course.group === undefined).sort((courseA, courseB) => dateFns.compareAsc(courseA.dateStart, courseB.dateStart))[0]
		let next = 0
		if (dateFns.differenceInSeconds(course.dateStart, new Date()) < config.delay+1) {
			let subjectHue = course.subject.split('').map(a => a.charCodeAt(0)).reduce((a,b) => a+b)
			let embed = new MessageBuilder()
				.setName(config.name)
				.setAvatar(config.avatarUrl)
				.setColor(config.color)
				.setTitle(course.subject.replace(/\\/g, ''))
				.setDescription(course.teacher.replace(/\\/g, ''))
				.setTime(course.dateStart / 1000)
			if (course.room !== undefined) {
				embed.setFooter(course.room.replace(/\\/g, ''))
			}
			hook.send(embed)
			console.log('Course ' + course.subject + '; Teacher ' + course.teacher)
			next = dateFns.subSeconds(course.dateEnd, config.delay)
		} else {
			next = dateFns.subSeconds(course.dateStart, config.delay)
		}
		console.log('Next reload : ' + next)
		setTimeout(loadCalendar, dateFns.differenceInMilliseconds(next, new Date()))
	}).catch(e => console.error(e))
}

loadCalendar()
