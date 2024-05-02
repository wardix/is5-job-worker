export function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return ''
  const digitsOnly = phoneNumber.replace(/[^0-9]/g, '')
  return digitsOnly.startsWith('0')
    ? '62' + digitsOnly.substring(1)
    : digitsOnly
}

export function convertToSeconds(timeStr: string): number {
  const unit = timeStr.charAt(timeStr.length - 1)
  const value = parseInt(timeStr.slice(0, -1))

  switch (unit) {
    case 's':
      return value
    case 'm':
      return value * 60
    case 'h':
      return value * 3600
    case 'd':
      return value * 86400
    case 'w':
      return value * 604800
    default:
      throw new Error('Invalid time format')
  }
}

export function parseAttributes(input: string): any {
  const INITIAL_STATE = 0
  const READING_ATTRIBUTE = 1
  const IN_QUOTE = 2
  const READING_VALUE = 3
  const AFTER_SEPARATOR = 4

  const parsedAttributes: any = {}
  let currentQuoteCharacter = '"'
  let currentState = INITIAL_STATE
  const attributeBuffer: string[] = []
  const valueBuffer: string[] = []

  function commitAttribute() {
    const attributeName = attributeBuffer.join('')
    const attributeValue = valueBuffer.join('')
    parsedAttributes[attributeName] = attributeValue
    attributeBuffer.length = 0
    valueBuffer.length = 0
    currentState = INITIAL_STATE
  }

  for (let i = 0; i < input.length; i++) {
    const currentCharacter = input[i]

    switch (currentState) {
      case INITIAL_STATE:
        if (currentCharacter === ' ') continue
        if (currentCharacter === '=') {
          throw new Error(
            'Parsing error: "=" encountered without an attribute name.',
          )
        }
        currentState = READING_ATTRIBUTE
        attributeBuffer.push(currentCharacter)
        break

      case READING_ATTRIBUTE:
        if (currentCharacter === '=') {
          currentState = AFTER_SEPARATOR
        } else if (currentCharacter === ' ') {
          throw new Error(
            'Parsing error: Space encountered within an attribute name.',
          )
        } else {
          attributeBuffer.push(currentCharacter)
        }
        break

      case AFTER_SEPARATOR:
        if (currentCharacter === '"' || currentCharacter === "'") {
          currentState = IN_QUOTE
          currentQuoteCharacter = currentCharacter
        } else if (currentCharacter !== ' ') {
          currentState = READING_VALUE
          valueBuffer.push(currentCharacter)
        }
        break

      case READING_VALUE:
        if (currentCharacter === ' ') {
          commitAttribute()
        } else {
          valueBuffer.push(currentCharacter)
        }
        break

      case IN_QUOTE:
        if (currentCharacter === currentQuoteCharacter) {
          commitAttribute()
        } else {
          valueBuffer.push(currentCharacter)
        }
        break
    }
  }

  if (currentState === READING_VALUE) {
    commitAttribute()
  } else if (currentState !== INITIAL_STATE && currentState !== IN_QUOTE) {
    throw new Error('Parsing error: Input ended unexpectedly.')
  }

  return parsedAttributes
}
