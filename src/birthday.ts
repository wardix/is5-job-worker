import { promises as fs } from 'fs'
import { createCanvas, loadImage } from 'canvas'
import sharp from 'sharp'
import axios from 'axios'
import os from 'os'
import path from 'path'
import {
  birthdayGiftVoucherPeriodDays,
  birthdayGiftVoucherTemplatePath,
  birthdayPicPhones,
  birthdayWishes,
  nusaworkEmployeeApiUrl,
} from './config'
import {
  fetchNusaworkAuthToken,
  sendWaNotification,
  sendWaNotificationMedia,
} from './api'
import logger from './logger'

async function getAllEmployee() {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const formatedToday = `${yyyy}-${mm}-${dd}`

  const payload = {
    fields: {
      active_status: ['active'],
    },
    page_count: 10000,
    currentPage: 1,
    periods: [formatedToday, formatedToday],
  }

  try {
    const token = await fetchNusaworkAuthToken()
    const response = await axios.post(nusaworkEmployeeApiUrl, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
    return response.data.data.list
  } catch (error: any) {
    logger.warning(`Error get all employee: ${error.message}`)
  }
}

function getEmployeesWithBirthdayToday(employees: any[]) {
  const today = new Date()

  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
  })

  const ddmmToday = formatter.format(today)
  return employees.filter((employee) => {
    const birthDate = new Date(`${employee.date_of_birth}T00:00:00`)
    return ddmmToday == formatter.format(birthDate)
  })
}

export async function sendGiftVoucherToBirthdayEmployees() {
  try {
    const employees = await getAllEmployee()
    const birthdayEmployees = getEmployeesWithBirthdayToday(
      employees.filter((employee: any) => {
        return employee.status_join != 'Internship'
      }),
    )
    if (birthdayEmployees.length == 0) {
      return
    }
    const tempDir = os.tmpdir()
    const uniquePrefixDir = path.join(tempDir, 'job-')
    const uniqueDir = await fs.mkdtemp(uniquePrefixDir)
    const giftOutputPath = path.join(
      uniqueDir,
      path.basename(birthdayGiftVoucherTemplatePath),
    )
    const ccPhones = JSON.parse(birthdayPicPhones)
    for (const e of birthdayEmployees) {
      const voucherEndPeriodDate = new Date(
        Date.now() + 86400000 * +birthdayGiftVoucherPeriodDays,
      )
      let contactNo = (e.whatsapp ? e.whatsapp : e.mobile_phone) as string
      if (contactNo.startsWith('0')) {
        contactNo = `62${contactNo.substring(1)}`
      }
      await createBirthdayVoucherGift(
        birthdayGiftVoucherTemplatePath,
        giftOutputPath,
        e.full_name,
        voucherEndPeriodDate,
      )

      sendWaNotificationMedia(contactNo, giftOutputPath, birthdayWishes)
      for (const phone of ccPhones) {
        sendWaNotificationMedia(phone, giftOutputPath, birthdayWishes)
      }
    }
    await fs.rm(uniqueDir, { recursive: true })
  } catch (error: any) {
    logger.warning(`Error send gift voucher ${error.message}`)
  }
}

function getNextWeekDates() {
  const dayMap: any = {
    Minggu: 0,
    Senin: 1,
    Selasa: 2,
    Rabu: 3,
    Kamis: 4,
    Jumat: 5,
    Sabtu: 6,
  }
  const longDayFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
  })
  const ddmmFormatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
  })
  const today = new Date()
  const day = longDayFormatter.format(today)
  const nextWeekDiffDays = 7 - dayMap[day]

  const nextWeekDates: string[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(today.getTime() + (nextWeekDiffDays + i) * 86400000)
    nextWeekDates.push(ddmmFormatter.format(date))
  }
  return nextWeekDates
}

function getEmployeesWithBirthdaysNextWeek(employees: any[]) {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
  })
  const nextWeekDates = getNextWeekDates()
  return employees.filter((employee) => {
    const birthDate = new Date(`${employee.date_of_birth}T00:00:00`)
    return nextWeekDates.some((date) => date === formatter.format(birthDate))
  })
}

export async function sendNotificationNextWeekBirthdayEmployees() {
  try {
    const employees = await getAllEmployee()
    const employeesWithBirthdaysNextWeek = getEmployeesWithBirthdaysNextWeek(
      employees.filter((employee: any) => {
        return employee.status_join != 'Internship'
      }),
    )
    if (employeesWithBirthdaysNextWeek.length == 0) {
      return
    }
    const now = new Date()
    const currentYear = now.getFullYear()
    const notif: string[] = []
    const picPhones = JSON.parse(birthdayPicPhones)

    employeesWithBirthdaysNextWeek.sort((a: any, b: any): number => {
      let aBirthday = new Date(a.date_of_birth)
      let bBirthday = new Date(b.date_of_birth)

      aBirthday.setFullYear(currentYear)
      bBirthday.setFullYear(currentYear)

      if (aBirthday < now) {
        aBirthday.setFullYear(currentYear + 1)
      }
      if (bBirthday < now) {
        bBirthday.setFullYear(currentYear + 1)
      }

      return aBirthday.getTime() - bBirthday.getTime()
    })
    employeesWithBirthdaysNextWeek.forEach((e) => {
      notif.push(`${e.date_of_birth.substring(5)} ${e.full_name}`)
    })
    picPhones.forEach((phone: string) => {
      sendWaNotification({
        to: phone,
        msg: `Next week birthday:\n${notif.join('\n')}`,
      })
    })
  } catch (error: any) {
    logger.warning(
      `Error get employees with birthday next week: ${error.message}`,
    )
  }
}

async function createBirthdayVoucherGift(
  templatePath: string,
  outputPath: string,
  name: string,
  endPeriodDate: Date,
): Promise<void> {
  try {
    const textNameAreaX = 4
    const textNameAreaY = 484
    const textNameAreaWidth = 736
    const textNameAreaHeight = 100
    const textNameFontSize = 68

    const textEndPeriodX = 80
    const textEndPeriodY = 1020
    const textEndPeriodFontSize = 24

    const formatedEndPeriodDate = endPeriodDate.toLocaleString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // Load the existing image using sharp
    const imageBuffer = await sharp(templatePath).toBuffer()
    const image = await loadImage(imageBuffer)

    // Create a canvas with the same dimensions as the original image
    const canvas = createCanvas(image.width, image.height)
    const context = canvas.getContext('2d')

    // Draw the existing image onto the canvas
    context.drawImage(image, 0, 0)

    // Set initial text properties
    let fontSize = textNameFontSize
    context.font = `bold ${fontSize}px arial`
    context.fillStyle = '#FFD533'

    // Measure the text
    let textMetrics = context.measureText(name)
    let textWidth = textMetrics.width

    // Adjust font size if text does not fit
    while (textWidth > textNameAreaWidth) {
      fontSize -= 2
      context.font = `bold ${fontSize}px arial`
      textMetrics = context.measureText(name)
      textWidth = textMetrics.width
    }

    // Add the text to the image (centered)
    context.fillText(
      name,
      textNameAreaX + (textNameAreaWidth - textWidth) / 2,
      textNameAreaY + (textNameAreaHeight + fontSize) / 2,
    )

    context.font = `bold ${textEndPeriodFontSize}px arial`
    context.fillText(formatedEndPeriodDate, textEndPeriodX, textEndPeriodY)

    // Convert the canvas to a buffer
    const buffer = canvas.toBuffer('image/png')

    // Save the buffer to a file
    await fs.writeFile(outputPath, buffer)
  } catch (error: any) {
    logger.warning(`Error processing image: ${error.message}`)
  }
}
