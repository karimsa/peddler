export default async (ctx, next) => {
  ctx.res.write(`{"message":"${ctx.body}"}`)
  return await next()
}