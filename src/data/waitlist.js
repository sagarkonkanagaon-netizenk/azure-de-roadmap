// Pro waitlist. Answers go to a Google Form, so they land in a Google Sheet you own.
//
// To connect your form:
// 1. Create a Google Form with these questions, in this order:
//    Name (short answer), Email (short answer), Plan (multiple choice: 6 months, 1 year, Not sure yet),
//    Where are you now (multiple choice: Student, Switching careers, Working in data, Other),
//    What do you want most from Pro (paragraph).
// 2. In the form, open ⋮ → "Get pre-filled link", type anything in every box, click "Get link".
// 3. From that link, copy the long id after /forms/d/e/ into formId, and each entry.NNNN into fields.
// Until formId is set, the form opens an email to BRAND.email with the same details, so nothing is lost.
export const WAITLIST = {
  formId: '',
  fields: {
    name: '',
    email: '',
    plan: '',
    stage: '',
    want: '',
  },
}

export const PLAN_CHOICES = ['6 months', '1 year', 'Not sure yet']
export const STAGE_CHOICES = ['Student', 'Switching careers', 'Working in data', 'Other']
