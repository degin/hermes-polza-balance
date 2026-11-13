/**
 * Polza balance: чип с балансом Polza.ai в статус-баре. Вер. 1.
 * Данные: ctx.rest('/balance') -> бэкенд dashboard/plugin_api.py. Опрос раз в 2 минуты, клик обновляет сразу.
 * Цвет: выше WARN_FROM нейтральный, дальше плавно краснеет и достигает полного красного на RED_AT.
 */
import { Codicon, STATUSBAR_AREAS, Tip, cn, queryClient, useQuery } from '@hermes/plugin-sdk'
import { jsx, jsxs } from 'react/jsx-runtime'

const QUERY_KEY = ['polza-balance']
const POLL_MS = 120_000
const WARN_FROM = 500 // ₽: с этого значения начинается покраснение
const RED_AT = 100 // ₽: на этом и ниже цвет полностью красный
const RED = '#ef4444'

const LOCALES = {
  en: { name: 'Polza.ai balance', refresh: 'Click — refresh now', available: 'available', reserved: 'reserved', updated: 'updated', low: 'Low balance', noKey: 'No Polza API key', failed: 'Balance unavailable', stale: 'stale data' },
  ru: { name: 'Баланс Polza.ai', refresh: 'Клик — обновить сейчас', available: 'доступно', reserved: 'в резерве', updated: 'обновлено', low: 'Баланс на исходе', noKey: 'Нет ключа Polza', failed: 'Баланс недоступен', stale: 'данные устарели' }
}

function redShare(amount) {
  if (amount <= RED_AT) return 1
  if (amount >= WARN_FROM) return 0

  return (WARN_FROM - amount) / (WARN_FROM - RED_AT)
}

function colorFor(amount) {
  const share = Math.round(redShare(amount) * 100)

  return share === 0 ? undefined : `color-mix(in oklab, var(--ui-text-tertiary) ${100 - share}%, ${RED})`
}

function rub(value, digits = 0) {
  return `${Number(value).toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ₽`
}

function tipBody(data, t) {
  const row = (label, value, key) =>
    jsxs('div', { className: 'flex items-center justify-between gap-3 tabular-nums', children: [
      jsx('span', { children: label }, 'l'),
      jsx('span', { className: 'text-(--ui-text-secondary)', children: value }, 'v')
    ] }, key)
  const rows = [jsx('div', { className: 'font-medium', children: t('name') }, 'head')]

  if (data?.amount != null) {
    rows.push(row(t('name'), rub(data.amount, 2), 'amount'))
    if (data.available != null && data.available !== data.amount) rows.push(row(t('available'), rub(data.available, 2), 'avail'))
    if (data.reserved) rows.push(row(t('reserved'), rub(data.reserved, 2), 'res'))
    if (data.updated_at) rows.push(row(t('updated'), new Date(data.updated_at).toLocaleTimeString('ru-RU'), 'upd'))
    if (data.stale) rows.push(jsx('div', { className: 'text-(--ui-text-quaternary)', children: t('stale') }, 'stale'))
    if (data.amount <= RED_AT) rows.push(jsx('div', { className: 'font-medium', style: { color: RED }, children: t('low') }, 'low'))
  } else {
    rows.push(jsx('div', { children: data?.error === 'no_key' ? t('noKey') : `${t('failed')} (${data?.error ?? '…'})` }, 'err'))
  }
  rows.push(jsx('div', { className: 'text-(--ui-text-quaternary)', children: t('refresh') }, 'hint'))

  return jsxs('div', { className: 'flex flex-col gap-1', children: rows })
}

function BalanceChip({ ctx }) {
  const t = ctx.i18n.t
  const { data } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => ctx.rest('/balance'),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 0
  })

  const ok = data?.amount != null
  const label = ok ? rub(data.amount) : '—'
  const color = ok ? colorFor(data.amount) : undefined

  return jsx(Tip, {
    label: tipBody(data, t),
    children: jsxs('button', {
      className: cn(
        'inline-flex h-full items-center gap-1 rounded-none px-1.5 text-[0.6875rem] tabular-nums transition-colors hover:text-foreground',
        !color && 'text-(--ui-text-tertiary)',
        ok && data.amount <= RED_AT && 'font-semibold'
      ),
      style: color ? { color } : undefined,
      onClick: () => {
        void ctx.rest('/balance?refresh=1').then((payload) => queryClient.setQueryData(QUERY_KEY, payload)).catch(() => {})
      },
      type: 'button',
      children: [
        jsx(Codicon, { name: ok && data.amount <= RED_AT ? 'warning' : 'credit-card', size: '0.7rem' }, 'icon'),
        jsx('span', { children: `Polza ${label}` }, 'label')
      ]
    })
  })
}

export default {
  id: 'polza-balance',
  name: 'Polza balance',
  description: 'Баланс Polza.ai в статус-баре; краснеет при приближении к 100 ₽.',
  register(ctx) {
    ctx.i18n.register(LOCALES)
    ctx.register({ id: 'chip', area: STATUSBAR_AREAS.right, order: 76, render: () => jsx(BalanceChip, { ctx }) })
  }
}
