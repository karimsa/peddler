const version = '0.0.1'

export default async (ctx, next) => {
  ctx.body = { version }
  return await next()
}