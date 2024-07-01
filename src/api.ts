import mime from 'mime-types'
import { promises as fs } from 'fs'
import axios from 'axios'
import {
  nusacontactSyncContactApiUrl,
  nusacontactApiKey,
  nusacontactSyncContactMaxAttempts,
  visitCardSummaryApiUrl,
  visitCardToken,
  waNotificationApiUrl,
  waNotificationApiKey,
  silenceAlertApiUrl,
} from './config'

export async function sendWaNotification({
  to,
  msg,
}: {
  to: string
  msg: string
}): Promise<void> {
  const payload = { to, type: 'text', msg }
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': waNotificationApiKey,
  }
  await axios.post(waNotificationApiUrl, payload, { headers })
}

export async function sendWaNotificationMedia(
  to: string,
  imageFilePath: string,
  caption: string,
): Promise<void> {
  const mimeType = mime.lookup(imageFilePath)
  const data = await fs.readFile(imageFilePath)
  const payload = {
    to,
    type: 'media',
    msg: `data:${mimeType};base64,${data.toString('base64')}`,
    options: { caption },
  }
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': waNotificationApiKey,
  }
  await axios.post(waNotificationApiUrl, payload, { headers })
}

export async function syncNusacontactContact(data: any): Promise<void> {
  if (!nusacontactSyncContactApiUrl) {
    return
  }
  let attempt = 0
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))
  while (attempt < +nusacontactSyncContactMaxAttempts) {
    try {
      await axios.post(nusacontactSyncContactApiUrl, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': nusacontactApiKey,
        },
      })
      break
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          attempt++
          if (attempt < +nusacontactSyncContactMaxAttempts) {
            await delay(1000)
          } else {
            // max retry reached
          }
        } else {
          // non retryable error occurred
          break
        }
      } else {
        // non axios error
        break
      }
    }
  }
}

export async function fetchVisitCards(): Promise<any> {
  const visitcardResponse = await axios.get(visitCardSummaryApiUrl, {
    headers: {
      Authorization: `Bearer ${visitCardToken}`,
      Accept: 'application/json',
    },
    params: {
      status: '0,1,2,3',
      row: 'all',
    },
  })

  const visitcardCurrentUserTickets = visitcardResponse.data._embedded

  return visitcardCurrentUserTickets
}

export async function submitSilenceAlert(data: any) {
  const headers = {
    'Content-Type': 'application/json',
  }
  await axios.post(silenceAlertApiUrl, data, { headers })
}
