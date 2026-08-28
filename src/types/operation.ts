import type { Component } from 'vue'

export type OperationSection =
  | 'hoje'
  | 'atendimento'
  | 'pedidos'
  | 'producao'
  | 'embalagem'
  | 'entregas'

export type OrderPage = 'list' | 'new' | 'detail'

export interface OperationPageConfig {
  title: string
  icon: Component
  subtitle?: string
}
