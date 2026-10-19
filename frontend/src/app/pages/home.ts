import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <section class="hero">
      <p class="eyebrow">Demo AcmeCommerce</p>
      <h1>Consulte clientes, pedidos e estoque.</h1>
      <p>Explore uma API de comércio com dados fictícios. Todas as operações desta interface são somente leitura.</p>
      <a class="button primary" routerLink="/customers" [queryParams]="{query: 'Alice'}">Começar por Alice Demo</a>
    </section>
    <section aria-labelledby="explore-title">
      <h2 id="explore-title">O que você pode explorar</h2>
      <div class="card-grid">
        <a class="card action-card" routerLink="/customers"><span class="eyebrow">01 · Clientes</span><h3>Encontre uma pessoa</h3><p>Busque pelo nome, e-mail ou ID e veja seu pedido mais recente.</p><span class="card-action">Buscar clientes →</span></a>
        <a class="card action-card" routerLink="/orders"><span class="eyebrow">02 · Pedidos</span><h3>Veja os itens</h3><p>Consulte status, itens e total de um pedido pelo número.</p><span class="card-action">Consultar pedido →</span></a>
        <a class="card action-card" routerLink="/inventory"><span class="eyebrow">03 · Estoque</span><h3>Confira a disponibilidade</h3><p>Pesquise um SKU e descubra quantas unidades estão disponíveis.</p><span class="card-action">Consultar estoque →</span></a>
      </div>
    </section>
    <aside class="demo-path" aria-label="Exemplo de jornada"><strong>Experimente este caminho</strong><span>Alice Demo → pedido 1002 → produto ABC-123</span></aside>
  `,
})
export class HomePage {}
