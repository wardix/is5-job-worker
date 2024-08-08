import {
  fetchNisEmployeePhoneNumbers,
  updateNisEmployeePhoneNumber,
  deleteNisGraphs,
  fetchNisGraphs,
  findDeadGraphs,
  getContactDetail,
  processEngineerTickets,
  fetchNisEmployeeStructs,
  updateNisEmployeestruct,
} from './database'
import {
  sendWaNotification,
  submitSilenceAlert,
  syncNusacontactContact,
} from './api'
import logger from './logger'
import { structureIgnoredEmployees } from './config'
import { formatContact } from './nusacontact'
import { convertToSeconds, formatPhoneNumber, parseAttributes } from './utils'
import {
  sendGiftVoucherToBirthdayEmployees,
  sendNotificationNextWeekBirthdayEmployees,
} from './birthday'
import { fetchNusaworkAuthToken, getAllEmployee } from './nusawork'
import { getFiberstarHomepass } from './fiberstar'
import { generateGamasMetrics } from './gamas-exporter'
import { generateOverSpeedBlockedSubscriberMetrics } from './overspeed-exporter'

async function synchronizeEmployeeData(): Promise<void> {
  const token = await fetchNusaworkAuthToken()
  const employees = await getAllEmployee(token)
  const nisEmployeePhoneNumbers = await fetchNisEmployeePhoneNumbers()
  const nisEmployeeStructs = await fetchNisEmployeeStructs()
  const ignoredEmployees = JSON.parse(structureIgnoredEmployees)

  employees.forEach(async (employee: any) => {
    const {
      employee_id: employeeId,
      id_report_to_value: reportToUserId,
      job_position: jobPosition,
      mobile_phone: mobilePhone,
      whatsapp,
    } = employee
    const [{ employee_id: reportToId }] = employees.filter(
      (e: any) => e.user_id == reportToUserId,
    )
    const { reportToId: nisReportToId, description } = nisEmployeeStructs.find(
      (e: any) => e.employeeId === employeeId,
    ) || { reportToId: '', description: '' }

    const nisEmployeePhoneNumber = nisEmployeePhoneNumbers.find(
      (e: any) => e.employeeId === employeeId,
    )

    const validPhone = formatPhoneNumber(whatsapp || mobilePhone)

    if (
      !ignoredEmployees.includes(employeeId) &&
      (reportToId !== nisReportToId || description !== jobPosition)
    ) {
      await updateNisEmployeestruct(employeeId, reportToId, jobPosition)
      logger.info(
        `update employee struct: ${employeeId} ${reportToId} ${jobPosition}`,
      )
    }

    if (
      !validPhone ||
      !nisEmployeePhoneNumber ||
      nisEmployeePhoneNumber.phoneNumber === validPhone
    ) {
      return
    }
    await updateNisEmployeePhoneNumber(employeeId, validPhone)
    logger.info(
      `update employee phone: ${employeeId}: ${nisEmployeePhoneNumber.phoneNumber} -> ${validPhone}`,
    )
  })
}

async function deleteDeadGraphLinks(): Promise<void> {
  const nisGraphs = await fetchNisGraphs()
  const deadGraphs = await findDeadGraphs(nisGraphs)
  if (deadGraphs.length == 0) {
    return
  }
  await deleteNisGraphs(deadGraphs)
}

async function syncNusacontactCustomer(phone: string): Promise<void> {
  const contact = await getContactDetail(phone)
  if (JSON.stringify(contact) === '{}') {
    return
  }
  const formattedContact = formatContact(phone, contact)
  await syncNusacontactContact(formattedContact)
}

async function silenceAlert(
  attributes: string,
  contact: string,
  notify: string,
): Promise<void> {
  try {
    const { duration, end, comment, ...matchers } = parseAttributes(attributes)
    if (!comment) {
      throw new Error("`comment' attribute is required")
    }
    if (duration && end) {
      throw new Error("conflict attributes: `duration' and `end'")
    }
    if (!duration && !end) {
      throw new Error("`duration' or `end' attribute is required")
    }
    const now = new Date()
    const endTime = end
      ? new Date(end)
      : new Date(now.getTime() + convertToSeconds(duration) * 1000)
    const silenceData: any = {
      matchers: [],
      startsAt: now.toISOString(),
      endsAt: endTime.toISOString(),
      createdBy: contact,
      comment,
    }
    for (const m in matchers) {
      silenceData.matchers.push({
        name: m,
        value: matchers[m],
        isRegex: false,
      })
    }
    await submitSilenceAlert(silenceData)
    sendWaNotification({ to: notify, msg: 'silenced' })
  } catch (error: any) {
    sendWaNotification({ to: notify, msg: error.message })
  }
}

export async function executeJob(jobData: any): Promise<void> {
  // Log the job data
  logger.info(`Execute job: ${JSON.stringify(jobData)}`)

  // Check the job name and execute the corresponding function
  switch (jobData.name) {
    case 'syncEmployeeData':
      await synchronizeEmployeeData()
      break

    case 'delDeadGraphLink':
      await deleteDeadGraphLinks()
      break

    case 'genOverSpeedBlockedSubscriberMetrics':
      await generateOverSpeedBlockedSubscriberMetrics()
      break

    case 'genGamasMetrics':
      await generateGamasMetrics()
      break

    case 'syncNusacontactCustomer':
      await syncNusacontactCustomer(jobData.phone as string)
      break

    case 'fetchEngineerTickets':
      await processEngineerTickets(jobData.notify as string)
      break

    case 'sendGiftVoucherToBirthdayEmployees':
      await sendGiftVoucherToBirthdayEmployees()
      break

    case 'sendNotificationNextWeekBirthdayEmployees':
      await sendNotificationNextWeekBirthdayEmployees()
      break

    case 'silenceAlert':
      await silenceAlert(
        jobData.attributes as string,
        jobData.contact as string,
        jobData.notify as string,
      )
      break

    case 'fiberstarHomepass':
      await getFiberstarHomepass()
      break

    default:
      logger.warn(`Unknown job name: ${jobData.name}`)
      break
  }
}
