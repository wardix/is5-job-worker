import path from 'path'
import fs from 'fs'
import axios from 'axios'
import {
  gamasAlertApiUrl,
  gamasMassIncidentCountThreshold,
  gamasMassIncidentPeriodSeconds,
  gamasMaxIncidentAgeSeconds,
  gamasMetricFilePath,
  gamasMetricName,
  nusacontactApiKey,
  nusacontactMetricsUrl,
  nusacontactQueueMetricFilePath,
  nusacontactQueueMetricName,
} from './config'
import { parseAttributes } from './utils'

// Define interfaces
interface Labels {
  [key: string]: string
}

interface Metric {
  labels: Labels
  value: number
}

interface Result {
  [metricName: string]: Metric[]
}

export async function generateNusacontactQueueMetrics() {
  try {
    const tags = ['helpdesk', 'billing', 'nusaid']
    const queueCount: any = {}
    const response = await axios.get(nusacontactMetricsUrl, {
      headers: { 'X-Api-Key': nusacontactApiKey },
    })
    const { inbox_waiting_start_time: metricsData } = parseMetricLines(
      response.data,
    )
    console.log(JSON.stringify(metricsData, null, 2))
    metricsData
      .filter((d) => {
        return d.labels.type == 'enqueued'
      })
      .forEach((d: any) => {
        for (const tag of tags) {
          if (!d.labels.tags.includes(tag)) {
            continue
          }
          if (tag in queueCount) {
            queueCount[tag]++
            continue
          }
          queueCount[tag] = 1
        }
      })
    const output = []
    for (const tag in queueCount) {
      output.push(
        `${nusacontactQueueMetricName}{tag="${tag}"} ${queueCount[tag]}`,
      )
    }
    const metricDirectoryPath = path.dirname(nusacontactQueueMetricFilePath)
    const tempDirectoryPath = fs.mkdtempSync(
      path.join(metricDirectoryPath, 'temp-'),
    )
    const tempFilePath = path.join(tempDirectoryPath, 'tempfile.txt')
    fs.writeFileSync(tempFilePath, output.join('\n'))

    fs.renameSync(tempFilePath, nusacontactQueueMetricFilePath)
    fs.rmdirSync(tempDirectoryPath)
  } catch (error) {
    console.error('Failed to retrieve or parse data:', error)
  }
}

// Parse lines into a structured object
function parseMetricLines(input: string): Result {
  // Split input into lines
  const lines = input.trim().split('\n')
  const result: Result = {}

  // Parse each line
  lines.forEach((line) => {
    // Ignore lines that start with '#'
    if (line.startsWith('#')) {
      return
    }

    const metricNameEnd = line.indexOf('{')
    const labelsStart = metricNameEnd + 1
    const labelsEnd = line.indexOf('}')
    const valueStart = labelsEnd + 1

    const metricName = line.substring(0, metricNameEnd).trim()
    const labelString = line.substring(labelsStart, labelsEnd).trim()
    const value = line.substring(valueStart).trim()

    const labels = parseAttributes(labelString)
    const metric: Metric = {
      labels,
      value: parseFloat(value),
    }

    if (!result[metricName]) {
      result[metricName] = []
    }
    result[metricName].push(metric)
  })

  return result
}
