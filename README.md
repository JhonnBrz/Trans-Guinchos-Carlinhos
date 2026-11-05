# Trans Guinchos Carlinhos

Landing page da Trans Guinchos Carlinhos, empresa de aluguel de guindastes
articulados de 30 a 100 toneladas. O único canal de contato é o WhatsApp
(51) 99727-7891.

## Estrutura

```
docs/            o site publicado: só HTML, CSS, JS e imagens
  index.html
  _headers         cabeçalhos HTTP de segurança (Cloudflare Pages / Netlify)
  assets/
    css/style.css
    js/boot.js     roda no <head>, antes da primeira pintura
    js/main.js     ponto de entrada (ES module)
    js/modules/    cabeçalho, slideshow do topo e animações de rolagem
    img/
tools/             ferramentas locais, nunca publicadas
  serve.py         servidor de preview com os mesmos cabeçalhos de produção
  enhance_images.py
tests/
  security-check.mjs
```

Só a pasta `docs/` vai para a hospedagem. Ferramentas, testes e este README
ficam fora do que o visitante consegue acessar.

## Rodando localmente

```bash
npm run dev        # http://127.0.0.1:5173
```

Sem Node, use direto: `python3 tools/serve.py`.

## Segurança

O site é 100% estático: não tem backend, banco de dados, formulário, login,
cookies, chaves de API nem coleta de dados. Isso elimina as classes mais comuns
de ataque (injeção de SQL, roubo de sessão, vazamento de credenciais). O que
existe de proteção:

- **Content-Security-Policy** restrita (`default-src 'none'`): o navegador só
  executa scripts do próprio site e das duas CDNs fixadas, e bloqueia scripts
  inline, `eval`, formulários, plugins e qualquer requisição não prevista.
- **Subresource Integrity** nas bibliotecas externas (GSAP, ScrollTrigger e
  Lenis): se a CDN for comprometida e o arquivo mudar, o navegador recusa.
- **Links externos** com `rel="noopener noreferrer"`.
- **Cabeçalhos HTTP** em `docs/_headers`: HSTS, `X-Frame-Options: DENY`
  (contra clickjacking), `nosniff`, `Permissions-Policy` e `Referrer-Policy`.

### Testes

```bash
npm test           # verificações estáticas
npm run test:live  # também testa o servidor rodando (npm run dev em outro terminal)
```

Os testes procuram segredos nos arquivos e em todo o histórico do git, validam
o CSP e o SRI, garantem que não há scripts inline, handlers `on*`, formulários
ou funções perigosas no JS (`eval`, `innerHTML`, `document.write`). No modo
`--live`, também tentam acessar `.git`, `.env`, arquivos fora de `docs/`,
travessia de diretório (`../`), listagem de pastas e métodos de escrita
(PUT, DELETE, POST).

### Ao publicar

- **GitHub Pages:** em *Settings → Pages → Build and deployment*, use
  **Deploy from a branch → `main` → `/docs`**. Assim só o site é publicado;
  testes, ferramentas e este README ficam de fora.
- **GitHub Pages** não permite cabeçalhos HTTP personalizados; lá vale só o CSP
  em `<meta>`. HTTPS e HSTS o próprio `github.io` já força. Proteção contra
  clickjacking (`frame-ancestors`) exige uma hospedagem que leia `_headers`,
  como Cloudflare Pages ou Netlify.
- **Link provisório:** o `index.html` tem `<meta name="robots"
  content="noindex, nofollow">` para o Google não indexar a prévia. Remova
  essa linha no lançamento oficial.

## Imagens

As fotos são as originais enviadas pelo cliente, convertidas para WebP em dois
tamanhos (inteira e 760 px para celular). Para tratar uma foto nova:

```bash
python3 tools/enhance_images.py original.jpg --name obra-construcao
```
