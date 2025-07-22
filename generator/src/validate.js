export function validate({conversions} = {}) {
    if (Object.keys(conversions) < 1) throw new Error('No conversions found')
    Object.entries(conversions).forEach(([ref, rates]) => {
        if (Object.keys(rates).length < 20) {
            throw new Error(`Too few rates found for ${ref}`)
        }
        Object.entries(rates).forEach(([cur, rate]) => {
            if (typeof rate !== 'number' || isNaN(rate) || rate <= 0) {
                throw new Error(`Invalid rate for ${cur} -> ${ref}: ${rate}`)
            }
        })
    })
}
