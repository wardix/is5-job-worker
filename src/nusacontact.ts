export function formatContact(phoneNumber: string, contact: any): any {
  const customerIdLinkPrefix = 'https://isx.nusa.net.id/customer.php?custId='
  const customerIdLinkSuffix = '&pid=profile&module=customer'
  const subscriptionIdLinkPrefix =
    'https://isx.nusa.net.id/v2/customer/service/'
  const subscriptionIdLinkSuffix = '/detail'

  const formattedContact = {
    phone_number: phoneNumber,
    name: contact.name,
    timezone: 'Asia/Jakarta',
    branch_code: contact.branches.join(', '),
    attributes: '',
  }

  if (contact.branches.includes('062')) {
    formattedContact.timezone = 'Asia/Makassar'
  }

  const attributes: any = {
    ids: contact.ids
      .map(
        (e: string) =>
          `[${e}](${customerIdLinkPrefix}${e}${customerIdLinkSuffix})`,
      )
      .join(', '),
    companies: contact.companies
      .map(
        (e: any) =>
          `[${e.name}](${customerIdLinkPrefix}${e.id}${customerIdLinkSuffix})`,
      )
      .join(', '),
  }
  if (contact.services.length > 0) {
    attributes.services = contact.services
      .map(
        (e: any) =>
          `[${e.name}](${subscriptionIdLinkPrefix}${e.id}${subscriptionIdLinkSuffix})`,
      )
      .join(', ')
  }
  if (contact.accounts.length > 0) {
    attributes.accounts = contact.accounts
      .map(
        (e: any) =>
          `[${e.name}](${subscriptionIdLinkPrefix}${e.id}${subscriptionIdLinkSuffix})`,
      )
      .join(', ')
  }
  if (contact.addresses.length > 0) {
    attributes.addresses = contact.addresses
      .map(
        (e: any) =>
          `[${e.name}](${subscriptionIdLinkPrefix}${e.id}${subscriptionIdLinkSuffix})`,
      )
      .join(', ')
  }

  formattedContact.attributes = JSON.stringify(attributes)

  return formattedContact
}
