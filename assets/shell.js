// 모든 페이지 공통: 상단 메뉴·하단 메뉴 넣기, 스크롤 진행 표시, 로그인 확인(초대장 가입 화면 /join 만 로그인 없이 연다).
// 각 페이지는 <div class="app"> 안 맨 위에서 이 스크립트를 동기로 불러 헤더가 깜박임 없이 먼저 그려지게 한다.
(() => {
  const path = (location.pathname.replace(/\/+$/, "") || "/").replace(/\.html$/, "");
  const GATE = path === "/join";
  const html = document.documentElement;
  html.classList.add("pending");

  // ── 전역 로더: 페이지가 열리는 동안(로그인 확인·첫 데이터 불러오기까지)과 안쪽 링크로 옮겨 가는 동안 마스코트가 콩콩 뛴다.
  // 상단바·하단바는 가리지 않는다(그 사이 본문 자리만 덮는다). 최소 MIN ms 는 떠 있다가 내려간다(너무 번쩍 사라지면 오히려 깜박여 보인다). TT.loader.show()/hide() 로 페이지가 직접 켜고 끌 수도 있다.
  // CHARS:begin (scripts/make_loader_chars.py 가 만든다 — 직접 고치지 말 것)
  const CHARS = ["data:image/webp;base64,UklGRoAFAABXRUJQVlA4IHQFAADwIwCdASqQAJAAPrFOoUsnJCMhqZdboOAWCWNIswFkywn6kE1IbeQRAW345FTHzt/BUGoq0S6hGIU21BxgwyLgA9z/WgKQpFSQv7hYo1P3wliNMQS2/Ez+4eTySr0pyBMpUXg5+6WfM1dLqFgonUEyfi+8VKt1nF5TuSQ9F5slQ6axkQ2aMQHll7D4Qa4M3WqtmsFQwWDZGr5ZNwAzD+PVUT5+LdLzo/Gn9yq7DFbuiMqnKS0R2nAVXxNQtbbKQQGuiDFn4veR9RfR0Y17mXdkLWA+V+bjKoQHcrSw+eKaXOVwnZM8Yuz/CMfmdT3YuMPhfSLjMxIm240lWHtlsiqT7+Qj8BfP90zN/a+y7SXYItPk/98+7XwsJgNP+2oqqhAD1/N1AldKAAD++D394d2M/ZO2vaDKXcNZFc/sFqmohILbplh+GRgb+ZAzimBv7JKIE7rp03BSVQ7nKKBrPmQATYeKcgzvZOUN5Wwl/ZMoo3Vyl5NXax0z57hrElUmZEDqruXmKFWYuAuyNV7zOnMZqHtSCHF6uUim59b/dl436fjZmq/ACRM4YRKltxLO0cf/Ut7dLx/0UeYDJLib31IBGdXd+LmpUeQ1k6F+sSzLG9aKJ/7RXSPlBifKUixc+JFqgn8G78Am9oqmv5lSbXhwzvJWdRk8IcS205iU4AJWi2vxehEm4rutPxnaz4pzpCjECaWD9MzdJeX8vLe0Azmpg3kfXzKvKVIE6GZB+Cx/K32IimCzK1LuA+LOITumUggM2a5OZ4uI1dc2otLtcXj+20X6FuwAjiYO+S9RRqxiwC7M74GreEdiJwWqUmw6KAVdc2NMGA6OVRoc+QLVgwjbo3bZnNjscg7Bj1sAfLDpdcdZTXaUsZQRNOlO5wUoEDl7EsUqgU5HgjAeMkxf9B8aNXvh6y6//P/Vrb8VVsYHcTMpY6L3ffmlM+uvKdC1ay9fqodPv2XdNe8bn778kpaeskXLG7iPesIONojE3wesh1/RoX2kfiFdC/lRdBW/lTfsfYk2233tu2hS2UAyk3yArpRVN9qVoRB0we/k7jxwM+jnoDt8WcunKAvBVP5lS0RaMEGRUUgenddjkh5rBMMyRi3bFTAsyrQprRSgaUM6Jkm2KWP3w43FvuntiGhu1qwV6MtKACzpnIEJfzdd7fgD4DbnCVBslcTPuo7F7zplyQqH6Fyzpea2MLkvEXamryD6uwCs6ePSYcxxcRXvrdhMSZWDeWmW/QYLvx3mhcUfhP/SbH8ryBLuwqWN8EE7FqIAJzGoiYJbvw6uFUgIIFpEa7kDvqAZi4RcLZrU+za7bwrbfk6+vLPSVDGa/9jIfvrgQq4l3ZnZ+hPYFmGX2e7kNlVBKEvWzJ/OsMDHIcuISNYTF0l0btcUS6xi4YYvAUUFRs9PGscjin5tIgwzf+uh2GcCI678hq/vslnbeDGymrUJ5FwGz8zT5xN50hzM2UOMp2E6LCko5Hi4NebovnPFZ+lbMA1RuxqXS1tkBPlKsnUAz2X9jTpKDAy9gJ4HzL0jAg3s8Lc6zSG5gzD6A44p/DgM2GfFr065mAASJvIsAKY8lHoVhx96tmroErH+ftIW15m5cUInToMRx4dbcYd6m2oAFxq3lVsJV1DFdjjhQmloH9csy83FFoz6nRcBIGizGjBGSEwKZ50ipP6Htp6ybjtp06oieowEHKHFGN/kPmTiSJsScFXXTqJIMlviZ3L/opdBp1wMGjaoOWwHQJu+l8SATGHlUMEiBCMcM+luxMrGF9DUf7hgfNofR4tmrLktaBU84Os/CroWqB4xkcY5KLHWBMD//0p5VP0VqdyhgkUpAHJ6wp1uVpNO2sETn/ODHQwA","data:image/webp;base64,UklGRqwEAABXRUJQVlA4IKAEAADQIQCdASqQAJAAPrFOoEwnJCMiKFSb2OAWCWMA0UJl4P7DFSYJ8HYCsczCzJvz35zLl6sRq8IDS0ItojsRP1A1nmnwn48KW+VvoowlJr5BI4B1QyS2d7caS5646YFPLsPebsCtMQzg7yQCays5TwD6Ft/yIe3wOW2QJX7oirrORtfpDkrylZ6EekH2yorR3FZKJS0eWNAV7Tpqu09qByVrhlFTMcEjAlafRECbCy4NteEzMpbUkz4K0ZL9KnuAvPfdWDAFHryKQJKty8RtBGm+aBSvODeMLfKFbZtT1mOeNbnzTK5beLXktF3+YuWU1RIIgC32AKuMFnVIZJ2xsbSBwlLVu/hNiq81gBASpx++yPf28VDOMAAA/vzUnIJ4DA6bsX4oX+SGrIAyMsSquRWXoN5Sehg5/yRhSu5DKxN2bGIZjA4tfH7KPW61MfclY3e+IbAIZVYHypnPiPLBdQWzE+2RC2VHitgB4czq4c+ld8yN7qBVZ6/0vCPfRGPcweYqoiTNuTdpkJEesC7uwqryKjSv70thGimIpqJJnFXbLLT6ghb2x6kPnsN51JGlMCozIdx6tM+XrjpeMtlq1wcAycZegVl0bLVuP5mx/CBtGFo7UbT3B+kMN3AUkpcfECh7hVOG9sdm2Hot1TSUdlAHeHAsbckdJWEPRXVaSJT9tyxK1AgfGmCHoC9OtMyMzOqxf7aAWWcFQNhb5h+rIahZDigGbtwkRUrziZzrg9Dw6p1ql7nk27jTld60m2mS6cfni6KOFuuApLJM19382UpBw59vba8husY80iHz3qfqRHgRNneqyySv3X5znmqT1Jqxhe7dt3vVB05N/aQss2icrXT2HXUai+XLhRuTTwETb8fQhen2SoHBasNBRJ0XZvFKMOsLX8gZ4NgFl95eCxdBdj4lLk26bboARrb08Qq2rEKo2QvU4Tzm59Dfu0hwApNrzEFYi/Z2pjHncPR2m5GcMSUJLwDNnBTKkIVBtIr6ZjyvlZf6Adtkmt/JfjUzpMC9Y48TB/6gmpLK3DKclkzfmW3cMfIpT+WuF+fmZyAF7z6i/W6LyUrCm0QTua6AQKpiIVmJuoVJxt7+gAZxSKIJSfjaArk/rq/NYvuU1UlUzD+qMj8QiKcHU565OcSPq+v6sNQbHG+eY3RO5LveDiegGyGjMXAScV1caLn8hNGMR2g18cyb8h24gF8//fUOhwYMvuBtvLAN4qEQ8mw5pXUm9Q5R5bAkABtSoazEeSCj2J8tlDKLGKU2uylnO2NK36Vndt+QLntMYWxZ6sRN1+1JiapjkytHkaYEWSvxH6U2DrfwQ+cgKvryVWzb5IfFDj/jnMsZItjrIkzYBOFIe8Nl3w0KZsUXycG33X9iiYm9HRviwGhl/Y2wFiP8W/QU/0oSM88KMg3XISHfoZD8/Q0UWxfLjkEfYkcq9yD+UNjyMy6jTsc+rA9LzdLYs5lPrhmwbe1jRuO1Nkjh6oy2dYmLs9pMK+WVpSQE3z8zCsA/Q2Wli1JZdAyQNu0fZnEJv2UVyhSkqRYjzbn83vOaOFoEyiW67nZ3w5lJ4sJVa98AAA==","data:image/webp;base64,UklGRoQFAABXRUJQVlA4IHgFAADQIwCdASqQAJAAPrFSoUynJKMipZW8SOAWCWMA0MUBLPegFBN5m4H54B9BfiXhT4gBKFhueeNGkoU6O7q99G1X6QxArI7hBorFum+og3zg472YW+llwTmhrnNrVjg2G3op11/tM9QKEClhpQGpS+6TdsWt1R+0SgoPNzfVNGYBL7rPyLh2KWQaEuju7LEUnNRGfHS9D8U2v+Hi/KZLkRp4fTWJ5cpZD9Bq2dbJCmkXTT1X5tBANQaurQiT9oqQI7SUudU6CrYz4gyb1Il10jgPBYiZGHg/YF/1C8MW4RrjKy68DJJN9Lhz8G0FrOCnfSJVtT3tLgdlIkUaELrATFfAdr6eLqZTeRduUJnmO/BLZ6H0/3l5l1AJ+R1XBZqNLCTp46/tDwAAAP795x/0wpByt8TDqiOJgyvL0wPQILz70hJ4KWSbOpvN1vWgaJNg1PTTSX6KJYHbzJwaiUMOrGgrw5LwlhZYFxENGVTaVUJTwbGuJBxgNhnMM99hxOz6fp8i/fNxCY+Wqk2/JeK8uv9sam5/W7ysJ5qFaLUwqwrv8y7DQGSVn7ugncFpeFuquUL6nu8ghbzBiidf3/bCWzhTjTaxHOeBrxK38p77AjsPXDTF3qBq0lgl21Kf5Yf7AdW9EjmV8N/zrAybJvNcTO2tZB1f45iP9EQ1kTdjQytnBxb9KSI9pK/dXFgfxEldHT++nRloBqtWv+8lhO9fcKeC2acUi+LBCZ9Nb4mo19/9u4Jg4tjQNwb0j77gYEYXaWsy33L9jqodA78B0Knhh3gRqmvSBY3gsGTAsH4ZZwWN24R3uifrK9h7cC7Dw3l+RWVzvD0dXXorHLzIw56tbyQSa6AeH+eVscGa6IUfenyyNtdjtL+rRrcE9MKwdLM7S9RxWg01K9KhQ3AmFozwaBRr+jKpLflJ7A7IjggvwQV+gkvbe7giFAeFenDQhIfs79WR9+1zK/TrkXxNmkKvwP8KfIT0Dfaku9Rl1Lc29a9ZMBNyosW5OcW8qyLK1hwM4MyranZlDmsRq92pU3K31mnrPit5sKdbzDIFZf61nawgclFxAVadj/FXCdCzpFx4S84lqIG2y101pJlQImZiYpfDce1R/AsMJPDgbzwivElf9pVyneqg6ZL3LxPJEn0zyGrZhzaUumAzfo6xl/0zgwM9UMf9hoSxSkyEK8M0dCbxMnF+l2IyT+Ey7UiP7x3xBBj0+dYBpc41fR1es5nrjai5y+YRXr9YfVPpfRCz/g4noCbugDh3sTbXQvnQ14pkgyfmw70ykPVotP8uFFsMepBT3RXZPszbTr2iawAZKnd9/waCgsJiTkX6sheRYkQJLKBtLrA8T5NsUEF5SUbZaWWnJfqZjKq309eDDeisjR+zCNxBq6M8zqtuVbZPiRFaFg4rVKRmzBxcUcVBMIL55yqVV1URrFYPwt0LoA3w6O/qkgQpglQ2dX/KhMKlQsSpo1sF87urjX44V+B9PRoCtSdw/eP/ODPJc5NS/SpP85Wg8+Q55zDwR3w7Am/rBx3bPQHax+sgRQhh/MaemxtDAssnolyiaEV9NpQqkvLChyrYfa0VIBs0QH/CvYpsVDFmIBsuV/GLNIPFOFWk/LZdCqs9gf/USZPkpFLF8YllGKQm6LmHtwOov7//t/r3PghEvvtrwTp2s07NQB3SeTTTEygGoVyC9FcayRms+TE642VEPdJYMMbLmEPfiI6A6F1poaSgUetzY0jxZrh9N5PFq+343QOsjRKaapbJMjJwWG2WI0RFqhip6bxipIVpxUhYXgyfF6M5oLV6ZXdAIeStSpbZ1mSK5ojenuCqoKX7vIB+XbiYuNDlZs2RhXT91Pn8i/BVAC70A0IAAA==","data:image/webp;base64,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","data:image/webp;base64,UklGRm4FAABXRUJQVlA4IGIFAACQIgCdASqQAJAAPrFOoEynJCMiKFPbuOAWCWIAzjZtYR6lZxeQJ+R9u+X6Ndvbz2PnRb8pvSuQYxfzTjshU374ZFjv2TRsKk5myb4gZP7AxLQWXldc65rh04bHBggr2Hu1SbXVjiGcrrazBGXl3j40G6a5216KlgjYm3rDQ8ty0zWpui5LODHw5EeUx8zJbKIkkU8h6bvvEFg2JoK2UPNQ9fBjMwMY9oMoZ+jkpSN+Z3z1yVX3aHopEdpsgVC8YeYCU1Myh/rjCrMaNxTQ1w9JnGrOGK3mIO+JifuCQos5cTA2YNWf7ycof+LWCQ70sKuFnVX47lkhniUtYb1XRA9si3jPFnjoJHByKG79/kPummZxbvD1BAZF5Eui5MAA/v4fkTSuFCeGW7ced59+fA59bnXudV5RBwtWoH6cefdlRk3ItlaRvze4LKJZfst0Qi2vyunGOH14DrdofjzvGcjAAHKDaZYwCf+Sb8KPTkoZXb3Y2iN9lfTFr3dPCINEsB7zhtzY2v6T27Q682yxysiOEKyJA4/SpneOm97itFS67I/ajC/9GgRoRs1230C59Mtp72ZZTAF5Z6munURMWMReQAnI3EKoAOym+f3i/h4CJU/PYn//H6VVsK1eHBpuxNNlMF5e3YrNB7uz/wPNqLmX0pKmegKnVfEUNYPaxFKFSm5wZdqD2OtmWFNC8wkHkpImUrJA+oX8FbSsoxGqgO6wqWscoJSmcPStbbZ1z8BIERJvn013gPL1D+Q/VitVitxGAYJ4z0/yQ+BgZ5shaJFEdrhrkyEoFuAHMNYrtCG8CGDYYuS0sCxwZ0f2qitN3U+7nLEqMYqRbdv8PrCYlsLiDK3RNpCMwhPn+k9j3zlehtMWp/iFIVBGt4/SVh+7RcKYx8zmQm/fR5WySHcCkrMNNEorOQu2BzNi/6diOl6md8rbUbGwN8FgN4mdrn1h3tYK+a3p075NPF6rH++KN2oP3ulZMfecdQd9jIpI8B+nBuBdrzWS2+8X73kuih+R+F273bbos5bnAqDMMLI8yektN3zfp+MczOke1qkCFUwvjHhfY/4j4H6Nt+1l8s434cP7IcAIjyciEwVKd4iEU/cbqMJ7+73bXemXZH5hyxw+FyZxmV2F9i4hagdujIh9Tu9tCXc4Q91IcvUZgWZRCbeHznMVwkmIWd0AK9sqzZjPFABUdHOx/MVD4b5dxbtotXVyScuPquiebjmYSfT90MYjgwe/163gVxo4hxpV7zmK9yZQCnWi9b/dTsPD1rS2S6IEN4COfC8KMsTAqBPIQRd5LndvO+tx/LcjtGMP1qH+wtNJJo0q3lE8LT37VnToX6d+CLhxm0oYimjM8xYvhx5LxG6mI0ucazwzXKeC1+dpw1C3olwpuSGEi2hlbcx8wTgziZMvqsAiv+WkDHxTYDYhv4SbM/2I+oWkEBKDhD41M92Snn8CTracBwaxmdemvJ/LakHzlgGSc2pJQ3J7LQzfgiJyMYbP4+T7KZkntJ2Bq29XJUmaatV8bXIZMpk32f+CKi4x8OReQVRdYTe6v1edakfbM36SnACXhi2NWIQJhp0ysFkudOIvi0WeW7lrNEiIOOZvedmej1b2LkG7lddUpC3zAzE1b6WKKap1AI25xi402IYV7ZN8FRh/3jVo5krnp+y0BgycHCMqb2F3rQCFNBwRp+4GqT4WbVaFw5ACl0aoW2tizdE8jooc6Xf3BtbDLqKNCUT7OOzoSFxBvSaZt790P91fH2MooTSM4PTJLg8Mtndb+u/P7ixImrfkyzs677QGBpkCynrEJcdwxoJtDUt5l96FaqcvSYOZ2uNugAAA","data:image/webp;base64,UklGRqwGAABXRUJQVlA4IKAGAADwJQCdASqQAJAAPrFQoUunJKMhp5XsQOAWCUAZ3JvqcVQMGeyb6IeWd9c3O36dBvTT9kNL8HPDfuEKZjvjBQ9SU9mfN22SNBE6Mg3gII1WvlyX7DbCGfurhZG6yXJ12Yu0Iqw+GKkFqqvn/rG1OG8PSpjt+RX4p5Vr8dcfiKr2QYN2H9IOh4jha1Tr+nmaVSVrtEbWEyJoQIVIZ4KIZdNaxDorCMGqxhVqNvBlvVqjZrvDzQP704v14Tnvd7KAd8JVqtoVJp79p1Ry+nyWoBdF16BBOHNvG05Fx/cqOpS5UbVZpcdt7HhA1ItaLfnYXuLte9Hj4GnBfDl0oea8vQasoo5rGr0PKQ4aEVfU9MM9Pwesm21bJYUhR4uRlaVV2xQFbEkHmIkhIa0mZGkgUBXUWUW+miw4HSAA/vx3r6XtmS3zbvGiviEqA2ncDPbFfBXU8es4DacUjPWsRXuEpGu2ZQUatVDUZlVSpO2T4i1mUeuuh7O+tnn2qWE4vH5EcxLthSODU0uvkTuLAM6BDhkdh4b2lmVT48+JchnWVu6jEl7Sn7FE/jLtgM/GiN6UNKaYeUKr0Yt0cfdZ4ebAWW1NqdW6AzpSn1wlpUH11ZySkEViHvalG9PumsXqWC6rHKQ36GTwtH6Dg+AtPQLPm7YzcDsaTnDbJhPr3lQEqUCqcj1dHR8vEhhWmK2ViZTBQXrOKa4UAf5IBt0vpZ/avsF19oetPKcWJDY4zuaOFc9UyZuQLqQ2jwG3ZNchZqvmmgSVrmjVMZHqzoz5IeZmhLIbm5bcmR2IPZrHTtPGYJ897qxiNyjlmQht7hm+78hRynpYEk0B9GHSWyqw+5T9dcqjvzykLgiI9yc7LdBg6PLsQy1No47pvmbPA1I4UHOK3RZTM3HPRIE9yoHE3tWVZc6gOzZpJN4Q6/gl/yMYlmZJaKqI6iOJD4enR+lTil3ZvbffJxhjEBbJL1BO5cS3X8ZbzMmGzIuCOrRQsn16PGgGVgNwe95M1otM4ytghwsn9gn3GX9BznJbqgKH5F/3NeDcBtYPP5j6lNOCAsXTrJNC+wlXxyL2UgxW0SorBjyRZ1gkdZ79pjWONTf5Jf2kLBZFpRR7VFQFLO/fXDirrOzwn8v7KoJlcwh5Pli5j25Dv42ZSGZfuWvycckxxkRuUFCsWFh2iw9UfbSNOsLPfJSjKC/mQIAvplrWjgWF5wgPnvzQpW8/IEDJj7AMz00dSynN6DQqjqflvZvTS62zTGfVzQXcsO+iD8HJM407MNoO7G5+iqmi26DPnIceOHx1acHm+aw5TiHl0/XgK8cY8RBVK1Gw1yqImU/DYULmK/Kzb8DO3RCXEjMdGczYWRfOK4gn5RQw2lKZRYCQQZaI34ItKd8gi40tjvQnnN6VeXzM0XSJHK+KP1IGXgqIgXecE/YbXu6dkIbek89Wk1Idzy31ODKIJDcrWXi8MNZX8jGvXpEEVLWfhZNc2Ez01se7meowwvrIdldq8FL4bYzn2ee77E/I1UktEFNPNq08gjo3fKSjYWxB6Ra5kX94zhYHQ0Cmnsenky+k6ihm3umvBptK4lKp4ok4q5seNElV5kZ4v0LkDA1fQnwLrYSNQPi4ExbrMSZGNDhxU5zaWr59ry9BbxOgMP0NnsTfAklco0WbtbMwcdeQyQ7eC2B8t6cuxrNPh17UoqIzfDcSe5UI0VQH9Rr4BrP7YJX0eMlDQCmuqDxjUy8XntZlCSi7TWwp9F3m+nycrE/0N+txonFYRGOw9F7bgbidOsGlwak+DQclQigEy+lZqmu+y2+CAfQlXkLP7PDq1CBdEvRrGupNgMXEtZpftQB8rp3XSwgKdDCKu0G65zznrV88QCwh21KB41H53X+19TidLLuB/i4n7ALX1OpiWy/VfqQtBNMM1bEozASS/AsfiaAbT2C2yPPqhCDhr7My/sllv1NnjUcOi/MKshApuy2YpdHVZh+TVO06A7OcgG0BvZnXP/lpzsX8mffBhckrLq3mzIE7pxz5rYTBa/lJhrPWMpG1wbXlcBcg288wp2YMHNJLacm13eK/YPAR+Mp8vkWQhc/qYwDivoEycw6yXHDtJqaMI79WHj6qoG+jQG/hVJLqwbfW+/YHusnKUeHXik2lwP3QA/n8yhJDiuGEYgd8+Po/LDjxrzdhBPuAisNuwzaUZwONFdUCKyQQtQDW8bBLPFiS3LjK9rdVPGaZQuQAdqoRsB40RrRjt2Cl00kPixUqEs51wnWBAAAA","data:image/webp;base64,UklGRnwEAABXRUJQVlA4IHAEAABwIACdASqQAJAAPrFMoUsnJCMhqlWLoOAWCWMAzeHdC6lvhMSQDlaml07tcH5YRvLqYPWRul1r1jbeFzRirIbgxKrui1pM9VAauwIcl6t0DnifqePnDk5b638tu2N696wlvy2vvmYfnWIU07FwVQZkg5kfYbebkIBEB/0SkRTqD4DXq0IlOo+KlSlUlQVjaGZYmwxcDq01NG0wbzKh0Rp2o2MVaRP7VgFPA1oBhUezb+6KVP+gN3aKnfExDluc0XvmzwouIsXdcqTuR73b1JseKMReK7TUkKbTaxE0FM/8wI2dBq82qmUS12u8X5SUKK1krcUkcdZdGp32Nx1Fio2+YQuwbAwwBWmpxeQAAP78d1DJA6r4m3HpO1c4SqzbKXSLg/LAdMIlcL9hDZhgRdXqNe1eCmwZVobSO3loX0OKB2hxb8C4oAH1gmM4khNsLBjbMIfGlpicXSzbZ3xWqb8Z5YbCZSJzrdklF4DCFdY0K9hl9b/nMROiSorsr0bKbH5ZA/Ki6Gj7ErI2gXvFPIGpAn+HV4g6DwGU1nHTFas0gCIrnsl/k0TApkBMzaxtveXnGOEBZXcF65OtrTtHhWiof6H+1XWV3RNqMs8zzhLMuT8YNwvgHJutZHdRFHc0fbRcXqrXJGdsoW5DgbWLql97mbuRZe/q1UZC5KarC8M/MAWlM57eQDE0JuYgvB1KpHnTJgUFNe+joHdH4KAnYQiND1NqVaqV23/9yEWHed+klddgQ06SVHRGYQnuCuqxvW7fRGscnbtOs3SnmVLnybECJIKHtfXLeXx+Ytjux1UVudA+pA2nVBF+BituZJWlts5xPPRN4JTOVZqxKA12qnvyjBeJ5PplmtrcqxkZp7GtMdeml44DcDOT8trQRcMD/Nuam+fPqO8y5kt1qTl4E4/kfjoUKISFYzLsDG606LG1nNSMqdXZSLipFEw/uQUqzLPArpYxhLyniawL5YAw+4/ryHjk223k1H5y6hfi6+LxJI1645qBYJG6ccfoUK5ORiSZNPLTCWvwJGxO3Ba93AYerl2ZUVdbkZ4IqtjT4h2ROLD7czAAXwLNTWp1+lP4sbhIMs6ACtqQBfZrqd7SB9kQR0IVYzAcaK3yKiwHIRavgbwRmnwwXXft9Nq6bk0UvibagxNdMHQfRfzTzDAlvQnaov6eEB380YM/CeOWspx6/GoCcYt8Zw/ZFdt6JQx2CugJWIj96R0GFe25dGp0EBtNyjZuy4CfFPUvK4A3w5KeHmAi9Y2X3Cu1N0AainnqU6Y44danyCJYwKocbiXpk4HRvLN/OOo0F++eTlF1fXouXK32sSjvb9ZvGGKoVmjIdHGiTdthaBrJIrapjWrnRhHhmcwqvha7ztWW1EPyrNLL9n96mPMhwFnLozaMzHl7T+S25JAsva1p90MO1CB0fE7sWvimRMZgaFo6pSPEsnuRC5JFXFzFCjIt5R51DiSUPi8ESNjSGoTYCu8EPMDkDuv2GL6uZvHZkIqy4fBo+XoAAA==","data:image/webp;base64,UklGRkgFAABXRUJQVlA4IDwFAADQIgCdASqQAJAAPrFQokwnJKMiptS8AOAWCWMAzaWoy6bh3ngNM5bUxvzrEru1oG6X2cFBTxk178KZsissm1lGYRImY7nTok3K5L5AwGXkSfnpN7PnUCaAoXtBNNltz3qKbMyKMzt2qUqYmqQIvfi96D/uprOGzj7vzqltdsxlO/dbkgLfymmdlVcPVWrKPjDoGLPD0DHBOEA+zsU6kMElM1rqX/BUIjx16zojv1E9U+kM28JDRGv7boSLhc/RXKxIdPvL+qy0phXMhRpNlcLR/acixee0gplFWfmXgWrPKXZ8bSy5hjo0zBZFxwIlQjqmn4uWohwdsZ5+JFyIQyq+ZHW4qtXUM7pSFwvnddZZSGyfE3YdKz4o+l4fB/EnAAD+/BC+b8e7b1U7cLU4ragej2aCxf87JJ8HVQdxTRJOceqwVFcIw1FPz5D481kcYIPa0/QZVCq31MdgmXKef4gCP/+b+BoMc8FUafi0Y12P0YijQ0AVX41cBHEF9YsqOBIvmGx/NRDiicptEfS0jsGwmgX7sGy462UR+w18R9hLIzuu77eSGFiaz/l0C8YTodRrLQaGGN1G8J3mNyoXMuTMs/iWhVGuUPew5CCAsYed7q1xqnKaUVfTITgTHUsV/JFqW7WCfCt6xSt768rjR1OTgDLR4I4z3JTRDKjXCQd65My551q8QmaXFwdf28VKqwGjotK9QBnA2YS5SsvRqWGYcjt/8g9Y1zvGshHZXbkQlvx2Hmvr9q9EZaDC02th940o5w66HPWCoAgKZyon4njuPSs4DgxNwA16UZ4YinZajAxubigzi2QSfIpq6yogs+YiTGM43lrSgalZmOJ4c/5w2nzXiBlwpzg8r9lBZFmgGlvXXuaMMJuKhtMgAmWfGdgMxvk7Y1nW6MW9JTqDcBj8s4qwFnOVGtu3aSTqctMomUjnCHiodNIJlE9KCANyErLqoGPMqPTiGlK8I/l9Kxx18dsC0b/hvLuHek3eTGPnPMndN8ItN0hrfP2I2RPPpeRrTJBb3D/4qUaNJijMer1e6RFvyNz7fu2k10H97FvnlQYc2sYAskO/TQnkF7+7C7K2XsdmX/bl1xnPvqe3Bnpfu2WiaBC2BHvE6ULqDoH1xnIMaAEDZCOhRhyYoP2Zn7d8eqXbabQrxtOm4f2YIRRNzgve13yGqN85W46gyu/38lwWpWDtl4I+uvm1NSAxMm//qnl/R3rltFLmyRR+EiT6ti3BzVRZ7Qg2qJVTGh6xFCTWZP0eCBPOMDEe/ZMpl9YpwFWhLNAexbM14pkFnfcdMZaYUgG615ssCiTksw8KwevVuIZ5CMIACpLDfjjEYY6MMpOQshCI2y6xSwT6KE/ilYdyp5ZCPUGwtLVkL3c63N8awehATLefhlbJ9875KD7qtS8gb2zILj7q5+gb9eVG41yMgKMghUcdj7Qb4SZ1wtSvTbfL1Xtbr7iBa0AysixuJSXNFSh+glp3QzLaMAx6fgA0riTgYv0ngRGnRldiCBed+fuX4zB+3oSlhwVwqwyfIxwhhFAd0s3Euq9veOJmWbZlOXuMBODTggCc7kV8L3Em1hkexkuQ0s3DElo/LFuU0EuYGU9zt46+ZkwE4DZ17bfjHMLVJm47jP5taK1aV5cjPA2TApcrI8E+66kvk+iJwWVE0w9+qvgN3BURDbwrDAMYVO2675sKd3zNJxgbpyVfzbOnM5nJX/CSs8QrXV8fhMReSvIslJJz9EeEuol2dAFykpH3Hkmtb2MvwomANo3/O2uh4lmuLOAAAA==","data:image/webp;base64,UklGRgYFAABXRUJQVlA4IPoEAADwIACdASqQAJAAPrFSpEynJKOiJlYKsOAWCWMAz9pX5eHZJ9Dfis2KKjSRrfHc47uy/6GVrj2njWU3HjqUqoGZda80Y2GUNnMMepgsebi++4CBr3+qVJxqZlGBZCg/dj3rzDuDrPJfnmVQZaJdM1ihWQo4WmxF62M57K2v4Q5lDrR8TVmHZhOueAsT0koPWjHTXFOSgtcV1ouSvs6ntJIv5CY4xCFlrkVfMZ/nnmLLzdlFgyJLSM4JjvYpB8eh7gwgQKBEU1xhAaFEa2tzxXuhPT6B0MGHDM4Nf3z0jK6yvG39JAfcToCSwiH76cUaUAJNE1yYxBfSWavpoXf42iYPvrQz7gmhah3u3Rpb68aEAAD+/aUtIwK+gLJ7u3pcyc/wyYtAMCxBr+Mrdf5eke4GL6rjCa8O5R5JS3scqUlAKbLqdS5SMj4RCcN3tcmBNJpTawlHNBFsCdqpZwomAHdHn0uoNmGzuo50nG/TnLuY2cIim01lhU1pZXXMw+ewYAa0K+qJ22p4a/DNTdPqbgl62mGDkxKYR4ZfQckjBsXyunbZowL/qU7NViNX3L71kvhGCCKI8AgDBQi2aEFdQRM26gutenm7sheBjXzKHTHom4hoFZPsJQCiGes06Yr49VUJv87PByfz5YJJ/ROs3rz+S/3728Cjqdpv3HNlJSQvTkQGGHjpulz02LcK5+ep53FINiA1ZYYmNM7VwJ6lANd94+8/6vfOrxov3PGbJA3t2jO/F7KLWcJD5mcCJr+hyiA8QZCFqPSi1NTCj3F0lxk2S9ykc8/hvbAIsWhUjJ7YOCStnefeud5D6iv0n9NXVXwnJYr3E8BvBH9LDhM/4Tax/+XCd2nzrhtxRbgcpGI7Ut4LReBoIQUSHYxdVPCdPKE+0aIFddM+JvxUbxL1lsr80MkQ0i6zJlpgwXMl/ytbqAC5DouXzh0uU29BAnyQ4wlnKcfP9v/sXkVmaR+aSnChMNLVcJ4Yt9BT++nLgLijlTx2QAZc+6J4jyeqwyXV+eOSdjM1+smKoZ1W4PKzoRwSYGAPiJkFro81dXESLVcXz7EiEB+l6X8Bqm23QVm5B0D+VRA5mKce1hjUQWnfvnNvdTuXgl7EiB5mzrJ+uG589MbPDchIWof1U61peZmJNMgK34iOTyoPnIJo6wm/d+QcfmXDs+FyGKhw7GXyYMEa7VuPr+rtN2UidTKgayWl1Z+0VJCOwrsagqkqVj9tZKCN0K7t/EqXIDfLBPnMpgaD/0EvA5TviGD6me5ic1dUj+gYCDtb+9UPCpCMTX4PgZe/8j22qlp9V3TDNl8AY3F3pgQFW7okY8NA0tBQPlJCterWFeWVDL8eZ1gB5+WKS6mZt+eas3pqxYc6oaDdtLt4pjvRyY2R/Uqd1DYuS3l5ZkA5TD4zMBNsR4il+LX+kZ2vx4Nwpr+9wSPd3SYz4oKY0BbOd1TTa79KjExgfAWKKRoTu6XMxWuszayJeLByJBRFrrD3uNlBQnCDaL83SlsxV9gBcmoG6799j74yBGn6rUjuFIoFGG/DKbySIju7HcIAaddJqKdEDLQ1KmjRZAku4/4gAuqGxJU4A7wY38oXp9AWtXuSitaS/H/veylMaUxnnw4cD4Pc0X0oRVZfc+zmeTagL4lRRaORSqARkhX+edthDQ2LravkUSocMzulCs7wW8Vn9C1U3ndAAA==","data:image/webp;base64,UklGRmwEAABXRUJQVlA4IGAEAAAwHQCdASqQAJAAPrFUo0ynJKMiJZba+OAWCWMIzqfoxRjmPDw3U7P1HuM8InHpW/4i8bqQgzmlp+bvU0FcdPth40ovssuUxOSve7v+jKbhQYSIrhAaPwvNvPfk9ZRRwYXBwLXvNOcKDRhwg6ndeFV6lxmscivh0VJEAZjoT8QxCRyUQlw9qruebLFlcR1kLfE8eTucpBiY77TyX7kKowkXvX0asx7YihLM1TZZXZ4pMxbPA25A5/re29Jqy2vlCh/zbg+rxKB5zby/QOjwW2xAY/NSlQCeCx7uD2bt1lYefVPKVhWkbgdxthxXo3GiQ/tMAAD+x5Vn8Xb9bfP9lbEngcR2xrND2s2oDzpMqeM0L6v5GQcnRdLouKv5SSZCyov9GP/f5WLMiXKa8YIihDcOn8AO/zEbvoJkWe9doOUD6DHHtWLn+Yh12nTTxZGd5RPABBhP7ERL6Pm019+OUQ9eqYecM8X8boLv6FHqSfzyTR+6bSSVYduVi0t9nHgct3fUwu88OdFCzxc2BbGUYwFwF9gLxdGaQRsV9P1nWCdUaU97ADMpng2UhatGffXsm3PM22flIcGUH+4n4WL5+gn9vtisxh3LMM/iccOXDdq4+fkmJQGL/tzc9b/l6GrY0JbAXFP91ycLBxno/h99PuZpnndDcZzr05ZZIW4g10WqqcUWKPuzyV9oyzpxEh1tciayhy0UgHJBbjLCU7utUc5KJpHo18kAcPw99WKhgH6t7GaqjWTeiiGtkGR11CkirFTW54Fvu+igaoPnOziS5iny+/cC/35FxYAspmr8G4kJZzq5bXlq5RvWbG6DEeOBtQr+0W8oYZNHcL6Pd2fEGnUgzF2LvicRXdxPeNKfk5AFxCuobIVJeHRpq5Oi7WhAequnkfAFHq6mAWVRh7UDqevVn8EB2FVP2wDoa9lUpfSPboTD+CjHSIEJa7AJHfOiqwAuRLdZScih8dP2zaqz5eaZP8EetXNh0IKXgCdIzyOqqLB+GWyRtBvUj4cYDqz32qi4kA5lT98teQ1oO+O53oym3RF0/MPsfU6yPaasOLDY95wdCNXN+gE5vHsJEPEjt9CxFzfO3Hiv+Csdw9OiuxkbfULHENPvIbwSn6pN2tbBGsSQ207AW9OzbjMvvI9HJzvpQOH3GGad/VQC31F8TC/reNk6hb/F4YxMkOPVGRva4EzKt6fuscRaSwZWFK0TohrGQVSVT88la10WGcfyzx0Cv5F+/X2pvWoLjo0W4YzReSwJjW7yiM2f5dq9fbAjh4spaT7R7Smhlu7f8L95Ow08qYLp+JwVAqEo3NdMuqJLle8fv8FhqowGC4djXgVVFpSH4eyn4e7gN4W6M7YxMd+9xTNk/GOacfnmt9IALFZ0cvPh3sc4q0eT6hVFrgVLtje5aIapX1TalftQFTHjD6lDfSRJudtJFTl1MYdW/TGsweo5FDC/EADpSktC4dd+nUIRUIRL6kSZ9bdUE4X1MIAA"];
  // CHARS:end
  const MIN = 500;   // 최소 0.5초(2026-11-18 요청) — 이보다 빨리 준비돼도 이만큼은 보여 준 뒤 내린다
  let busy = 0, shownAt = Date.now(), offT = 0, failT = 0;   // busy = 진행 중인 서버 호출 수(전부 끝나야 내려간다)
  document.body.insertAdjacentHTML("afterbegin",
    `<div class="gl" id="gl" role="status" aria-label="불러오는 중"><div class="gl__m"><div class="gl__bob"><div class="gl__card">${CHARS.map((c) => `<img src="${c}" alt="" width="96" height="96">`).join("")}</div></div><i class="gl__sh"></i></div>` +
    `<p class="gl__t">불러오는 중<span class="gl__d" aria-hidden="true"><b>.</b><b>.</b><b>.</b></span></p></div>`);
  // ── 낙엽 배경(2026-11-19 요청): 앱 뒤쪽에 낙엽 여섯 장이 아주 천천히 흩날린다. 스타일·움직임은 app.css 의 .leaves/.lf(CSS 애니메이션만, JS 반복 없음).
  // 값은 고정표(무작위 없음 → 페이지마다 같은 그림): x=가로 위치(%) s=크기 o=진하기 d=한 바퀴 걸리는 초 dl=시작 시차(음수 = 이미 떨어지는 중) sx=좌우 흔들림 r=처음 기울기
  const app = document.querySelector(".app");
  if (app && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const LEAVES = [[8, 22, .5, 34, -6, 38, -20, 0], [24, 28, .42, 42, -27, -46, 40, 1], [42, 18, .55, 30, -14, 30, 110, 2], [61, 26, .45, 38, -2, -36, -70, 0], [78, 20, .52, 46, -33, 44, 10, 1], [92, 24, .4, 36, -19, -30, 150, 2]];
    app.insertAdjacentHTML("afterbegin", `<div class="leaves" aria-hidden="true">${LEAVES.map(([x, s, o, d, dl, sx, r, k]) => `<i class="lf lf--${k}" style="--x:${x}%;--s:${s}px;--o:${o};--d:${d}s;--dl:${dl}s;--sx:${sx}px;--r:${r}deg"></i>`).join("")}</div>`);
    const lv = app.querySelector(".leaves");
    document.addEventListener("visibilitychange", () => lv.classList.toggle("leaves--off", document.hidden));   // 탭이 가려지면 멈춘다(배터리)
  }
  const glEl = document.getElementById("gl");
  const gl = {
    show() { clearTimeout(offT); clearTimeout(failT); shownAt = Date.now(); glEl.classList.remove("is-off"); },
    hide() { clearTimeout(offT); offT = setTimeout(() => glEl.classList.add("is-off"), Math.max(0, MIN - (Date.now() - shownAt))); },
  };
  // 안쪽 페이지로 가는 링크를 누르면(새 탭·다운로드·API 주소·같은 주소 제외) 다음 화면이 뜰 때까지 로더로 덮는다. 뒤로 가기로 되돌아오면(bfcache) 내린다.
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || u.pathname.startsWith("/api/") || (u.pathname === location.pathname && u.search === location.search)) return;
    gl.show();
  });
  addEventListener("pageshow", (e) => { if (e.persisted) gl.hide(); });
  failT = setTimeout(() => gl.hide(), 15000);   // 서버가 아예 안 답하는 경우에만: 15초 뒤에는 화면을 돌려준다(그 전에는 «다 그려졌다» 는 신호를 기다린다)

  const IC = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8.5 12.5h7M8.5 16h5"/></svg>',
    team: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="9" cy="8.5" r="3.2"/><path d="M3.5 19.5c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><circle class="f" cx="17" cy="9.5" r="2.4"/><path d="M16.5 14.7c2.4.2 3.9 1.7 4.3 4.3"/></svg>',
    me: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="f" cx="12" cy="8.5" r="3.6"/><path d="M4.5 20c.6-4 3.5-6.2 7.5-6.2s6.9 2.2 7.5 6.2"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3M16 8l4 4-4 4M20 12H9"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4"/></svg>',
    ai: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4.5 11.8 9l4.5 1.8L11.8 12.6 10 17.1 8.2 12.6 3.7 10.8 8.2 9zM18 3.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7zM17.5 14.5l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/></svg>',
    lib: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="f" x="3.5" y="5" width="17" height="14" rx="2.2"/><path d="M10 9.2v5.6l4.8-2.8z"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15.5H6.5A1.5 1.5 0 0 0 5 20z"/><path d="M5 20a1.5 1.5 0 0 0 1.5 1.5H19V18.5M9.5 8h5.5M9.5 11.5h4"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="M4.5 7.5 12 13l7.5-5.5"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 7.5l3 3"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/></svg>',
    present: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 4.5h17M5 4.5v10.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5M12 16v4M8.5 20.5h7M9.5 11l2-2.2 1.6 1.6 2.4-2.9"/></svg>',
  };
  const TABS = [["/", "홈", IC.home], ["/articles", "아티클", IC.doc], ["/library", "자료실", IC.lib], ["/glossary", "HR 사전", IC.book], ["/me", "마이페이지", IC.me]];
  const s = document.currentScript;
  s.parentElement.classList.toggle("app--gate", GATE);
  // 마이페이지 하단 메뉴의 새 소식 숫자(회의록·발표 자료 — 발표자에게만). 숫자는 서버 확인이 끝나야 알 수 있어서, 지난번 값을 기억해 두고(tt_al) 처음부터 그려 깜박임을 없앤다. 서버 확인이 끝나면 맞춰 고친다.
  let al = 0; try { al = Number(localStorage.getItem("tt_al")) || 0; } catch {}
  // 하단 «마이페이지» 아이콘 = 내 사진(없으면 첫 글자). /api/me 를 기다렸다 그리면 페이지를 옮길 때마다 «사람 아이콘 → 내 사진» 으로 깜박이므로, 지난번 값을 이 브라우저에 기억해 두고(tt_av = {i: 첫 글자, u: 사진 주소, d: 사진 데이터}) 처음부터 같은 모습으로 그린다.
  let av = null; try { if (localStorage.getItem("tt_in") === "1") av = JSON.parse(localStorage.getItem("tt_av") || "null"); } catch {}
  const avSig = (a) => a.i + "|" + a.u;
  const avHtml = (a) => `<span class="tab__av">${a.d || a.u ? `<img src="${(a.d || a.u).replace(/"/g, "")}" alt="">` : a.i.replace(/[&<>"']/g, "")}</span>`;
  s.insertAdjacentHTML("beforebegin",
    // 상단: 로고 + (로그인한 뒤) AI 도우미·알림. 페이지 메뉴는 하단바에 있어서 중복으로 두지 않는다. 회의록·발표·로그아웃은 마이페이지 안 «바로가기» 카드로 옮겼다.
    `<header class="top" id="top"><div class="wrap top__in"><a class="logo" href="/" aria-label="HR T | 니핑 홈">HR T<i>|</i>니핑</a>` +
    (GATE ? "" : `<div class="top__r"><button class="top__out top__ai" type="button" id="aiTop" aria-label="AI 도우미 열기" aria-haspopup="dialog" aria-expanded="false" title="AI 도우미">${IC.ai}</button><a class="bell" href="/notifications" aria-label="알림">${IC.bell}<b class="bell__n" id="bellN" hidden></b></a></div>`) +
    `</div></header>`);
  // 하단 메뉴: 가입·로그인 화면(/join)에는 «로그인» 하나만 가운데에 둔다. 나머지 메뉴는 로그인이 확인된 뒤에만 보인다.
  // 로그인 확인 전(.pending)에는 메뉴를 가리되, 이 브라우저에서 로그인한 적이 있으면(localStorage tt_in) 깜박임 없이 바로 보여 준다.
  const tabPath = /^\/(article|write)$/.test(path) ? "/articles" : path === "/team" ? "/me" : path; // 글 보기·글쓰기도 «아티클», T조 소개는 마이페이지 안에서 여니 «마이페이지» 로 친다
  // 아티클·자료실 하단 메뉴의 «새 게시물» 숫자: 내가 마지막으로 그 페이지를 본 뒤 남이 올린 글·피드(아티클)·링크(자료실) 수. 마이페이지 숫자처럼 지난번 값을 기억해(tt_tn) 처음부터 그린다.
  const NEWK = { "/articles": "a", "/library": "l" }, NEWL = { a: "아티클", l: "자료실" };
  let tnv = {}; try { if (localStorage.getItem("tt_in") === "1") tnv = JSON.parse(localStorage.getItem("tt_tn") || "{}") || {}; } catch {}
  const tabHtml = ([p, l, ic]) => `<a class="tab" href="${p}"${p === tabPath ? ' aria-current="page"' : ""}${p === "/me" && al ? ` aria-label="${l}, 새 소식 ${al}개"` : ""}><span class="tab__ic"${p === "/me" && av ? ` data-sig="${avSig(av).replace(/"/g, "")}"` : ""}>${p === "/me" && av ? avHtml(av) : ic}</span>${l}${p === "/me" ? `<b class="tab__n" id="meN"${al ? "" : " hidden"}>${al > 99 ? "99+" : al || ""}</b>` : ""}${NEWK[p] ? `<b class="tab__n" id="tn_${NEWK[p]}"${tnv[NEWK[p]] ? "" : " hidden"}>${tnv[NEWK[p]] > 99 ? "99+" : tnv[NEWK[p]] || ""}</b>` : ""}</a>`;
  s.insertAdjacentHTML("afterend", GATE
    ? `<nav class="tabbar tabbar--gate" aria-label="하단 메뉴"><a class="tab" href="/join" aria-current="page"><span class="tab__ic">${IC.me}</span>로그인</a></nav>`
    : `<nav class="tabbar tabbar--app" aria-label="하단 메뉴">${TABS.map(tabHtml).join("")}</nav>`);
  try { if (localStorage.getItem("tt_in") === "1") html.classList.add("known"); } catch {}
  // 아티클 목록·글 보기에서는 하단바 바로 위 오른쪽에 둥근 분홍 «글쓰기» 버튼을 띄운다
  if (/^\/(articles|article)$/.test(path)) document.body.insertAdjacentHTML("beforeend",
    '<a class="fab" href="/write" aria-label="글쓰기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17zM13.5 7.5l3 3"/></svg></a>');
  // 댓글·답글·수정 폼이 화면(하단바 위)에 보이는 동안은 글쓰기 버튼을 숨긴다 — 오른쪽 아래 «저장»·«취소» 버튼과 겹쳐 눌리지 않게(2026-11-20 팀원 의견).
  const fabEl = document.querySelector(".fab");
  if (fabEl) {
    let fq = 0;
    const fabSync = () => {
      fq = 0;
      const lim = (window.visualViewport ? visualViewport.height : innerHeight) - (document.querySelector(".tabbar")?.offsetHeight || 0);
      fabEl.classList.toggle("fab--off", [...document.querySelectorAll(".cmt-form")].some((f) => { const r = f.getBoundingClientRect(); return r.bottom > 0 && r.top < lim; }));
    };
    const fabQueue = () => { if (!fq) fq = requestAnimationFrame(fabSync); };
    addEventListener("scroll", fabQueue, { passive: true }); addEventListener("resize", fabQueue);
    window.visualViewport?.addEventListener("resize", fabQueue);
    new MutationObserver(fabQueue).observe(document.body, { childList: true, subtree: true });
    fabQueue();
  }

  // 스크롤 진행 표시: 헤더 아래 경계선이 왼쪽에서 오른쪽으로 차오른다
  const top = document.getElementById("top");
  let tick = false;
  const progress = () => {
    tick = false;
    const max = html.scrollHeight - innerHeight;
    top.style.setProperty("--p", max > 0 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(4) : 0);
  };
  addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(progress); } }, { passive: true });
  addEventListener("resize", progress);
  addEventListener("load", progress);
  progress();

  // 서버 호출 + 로그인 확인
  async function call(url, method = "GET", body) {
    busy++;
    try {
      const r = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "요청에 실패했습니다. 잠시 뒤 다시 시도해 주세요.");
      return j;
    } finally { busy--; }
  }
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initial = (u) => [...u.nickname][0] || "T";
  const avatar = (u) => (u.photoUrl ? `<img src="${esc(u.photoUrl)}" alt="">` : esc(initial(u)));

  // 글쓴이(author 가 null 이면 AI 캐릭터 «미드핑»), 몇 분 전/며칠 전, 하트 아이콘
  const who = (a) => a || { nickname: "미드핑", photoUrl: "/assets/miding.jpg" };
  const ago = (d) => {
    const s = (Date.now() - new Date(d)) / 1000;
    if (s < 60) return "방금"; if (s < 3600) return `${Math.floor(s / 60)}분 전`; if (s < 86400) return `${Math.floor(s / 3600)}시간 전`; if (s < 7 * 86400) return `${Math.floor(s / 86400)}일 전`;
    const t = new Date(d); return `${t.getMonth() + 1}월 ${t.getDate()}일`;
  };
  // 글·댓글을 쓴 정확한 시각: 오늘 09:54 / 어제 21:03 / 11월 17일 09:54 / 2025년 12월 3일 09:54 (이 기기의 시간대 기준)
  const stamp = (d) => {
    const t = new Date(d), n = new Date(), p = (v) => String(v).padStart(2, "0"), hm = `${p(t.getHours())}:${p(t.getMinutes())}`;
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((day(n) - day(t)) / 864e5);
    if (diff === 0) return `오늘 ${hm}`; if (diff === 1) return `어제 ${hm}`;
    return `${t.getFullYear() === n.getFullYear() ? "" : t.getFullYear() + "년 "}${t.getMonth() + 1}월 ${t.getDate()}일 ${hm}`;
  };
  // «언제 썼는지» 를 한 번에: 일주일 안이면 «오늘 09:54 · 24분 전», 그보다 오래되면 날짜·시각만
  const when = (d) => { const a = ago(d); return /전$|^방금$/.test(a) ? `${stamp(d)} · ${a}` : stamp(d); };
  const heart = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5C5.5 15.8 3 12.6 3 9.4 3 7 4.8 5.2 7.1 5.2c1.9 0 3.7 1 4.9 2.8 1.2-1.8 3-2.8 4.9-2.8C19.2 5.2 21 7 21 9.4c0 3.2-2.5 6.4-9 11.1Z"/></svg>';
  const bubble = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 17h-7l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5Z"/></svg>';
  // 닉네임 옆에 아주 작은 프로필 사진(없으면 첫 글자)
  const chip = (u) => `<span class="who"><span class="who__av">${avatar(who(u))}</span>${esc(who(u).nickname)}</span>`;
  // 글 종류 구분: 사람이 직접 / 사람이 AI 와 함께(ai=1, 글쓴이 있음) / T조 AI 가 씀(글쓴이 없음)
  const SPARK = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4-6.4-2.1 6.4-2.1z"/></svg>';
  const PERSON = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><circle cx="12" cy="8" r="3.6" fill="currentColor"/><path fill="currentColor" d="M4.8 20c.5-3.8 3.4-6 7.2-6s6.7 2.2 7.2 6z"/></svg>';
  const KINDS = { human: ["직접 쓴 글", PERSON], assist: ["AI와 함께", SPARK], ai: ["AI 작성", SPARK] };
  const kind = (p) => (p.ai ? (p.author ? "assist" : "ai") : "human");
  const kindChipOf = (k) => `<span class="chip chip--${k}">${KINDS[k][1]}${KINDS[k][0]}</span>`;
  const kindChip = (p) => kindChipOf(kind(p));
  // 오늘의 질문 · 이번 주 토론 · 토론을 정리한 아티클: 글 종류 칩 + 목록 카드 아래의 지목/진척도 줄
  // «답변 완료» 도장 — 지목된 사람이 제대로 답하면 지목 줄 오른쪽에 찍힌다(목록 카드·글 보기 공용)
  const STAMP = '<span class="stamp" role="img" aria-label="답변 완료"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>답변 완료</span>';
  const SPECIAL = { daily: "오늘의 질문", weekly: "이번 주 토론", digest: "인살롱 후보", feed: "피드" };
  const specialChip = (p) => (p.special ? `<span class="chip chip--${p.special}">${SPECIAL[p.special]}</span>` : "");
  const specialLine = (p) => p.special === "daily" && p.target
      ? `<p class="sp sp--daily">지목 ${chip(p.target)}${p.answered ? STAMP : ` · ${p.forMe ? "나에게 온 질문 · 답변 기다리는 중" : "답변 기다리는 중"}`}</p>`
    : p.special === "weekly" && p.progress
      ? `<div class="sp sp--weekly"><span class="sp__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.progress.pct}"><i style="width:${p.progress.pct}%"></i></span><span class="sp__t">${p.progress.stage === "report" ? "리포트 완성" : p.progress.stage === "ready" ? "리포트 준비 중" : p.progress.stage === "done" ? "정리 완료" : `의논 진행도 ${Math.min(p.progress.done, p.progress.goal)}/${p.progress.goal}명 · ${p.progress.pct}%`}</span></div>`
    : "";
  // 아티클 카드(목록·홈 공용): 왼쪽에 분류·글 종류·제목·미리보기, 오른쪽에 대표 사진·동영상 썸네일(있을 때만), 아래 줄에 글쓴이·시각·좋아요·댓글
  const PLAY = '<span class="th__play"><i><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg></i></span>';
  const thumb = (c) => (!c ? "" : `<span class="th${c.thumb ? "" : " th--none"}">${c.thumb ? `<img src="/api/media?id=${c.id}&v=thumb" alt="" loading="lazy" decoding="async">` : ""}${c.kind === "video" ? PLAY : ""}${c.n > 1 ? `<span class="th__n" aria-label="파일 ${c.n}개">+${c.n - 1}</span>` : ""}</span>`);
  const postCard = (p) => `<li><a class="art art--${kind(p)}${p.special === "weekly" ? " art--weekly" : ""}${p.cover ? " art--img" : ""}" href="${p.href || "/article?id=" + p.id}">
    <div class="art__main"><div class="art__meta"><span class="chip">${esc(p.category)}</span>${specialChip(p)}${kindChip(p)}</div>
    <h3 class="art__title">${esc(p.title)}</h3>
    <p class="art__text">${esc((p.excerpt || "").replace(/\s+/g, " "))}</p>${specialLine(p)}</div>${thumb(p.cover)}
    <div class="art__foot">${chip(p.author)}<span>${when(p.createdAt)}</span><span class="stat${p.liked ? " stat--on" : ""}">${heart}${p.likes}</span><span class="stat">${bubble}${p.comments}</span></div></a></li>`;
  const TT = (window.TT = { call, esc, initial, avatar, who, chip, ago, stamp, when, heart, bubble, postCard, kind, kindChip, kindChipOf, specialChip, SPECIAL, user: null, loader: gl });

  // 꾸민 드롭다운: <select> 를 숨겨 두고(값은 그대로 폼에 실린다) 그 자리에 버튼+목록을 그린다.
  // 키보드(↑↓ Enter Space Esc Home End)·스크린리더(listbox)를 지원하고, 아래 공간이 모자라면 위로 펼친다.
  // 옵션을 다시 채우거나 .value 를 코드로 바꿨다면 el._sel.sync()(옵션을 바꿨으면 build()) 를 부른다.
  const CHEV = '<svg class="sel__chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  let selN = 0;
  TT.select = (native) => {
    if (native._sel) return native._sel;
    const uid = "sel" + ++selN, lab = native.dataset.label;
    const wrap = document.createElement("div"); wrap.className = "sel";
    native.parentNode.insertBefore(wrap, native);
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "sel__btn"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = `<span class="sel__v" id="${uid}-v"></span>${CHEV}`;
    if (lab) btn.setAttribute("aria-labelledby", `${lab} ${uid}-v`);
    const list = document.createElement("ul"); list.className = "sel__list"; list.id = uid + "-l"; list.setAttribute("role", "listbox");
    if (lab) list.setAttribute("aria-labelledby", lab);
    btn.setAttribute("aria-controls", list.id);
    wrap.append(btn, list, native);
    native.classList.add("sel__native"); native.tabIndex = -1; native.setAttribute("aria-hidden", "true");
    const items = () => [...list.children];
    let act = -1;
    const isOpen = () => wrap.classList.contains("is-open");
    function sync() {
      const o = native.options[native.selectedIndex];
      document.getElementById(uid + "-v").textContent = o ? o.textContent : "";
      items().forEach((li, i) => li.setAttribute("aria-selected", String(i === native.selectedIndex)));
    }
    function build() {
      list.innerHTML = [...native.options].map((o, i) => `<li class="sel__opt" role="option" id="${uid}-o${i}" data-i="${i}" aria-selected="false">${esc(o.textContent)}${CHECK}</li>`).join("");
      sync();
    }
    function setActive(i) {
      items().forEach((li) => li.removeAttribute("data-active"));
      act = Math.max(0, Math.min(items().length - 1, i));
      const li = items()[act]; if (!li) return;
      li.setAttribute("data-active", ""); btn.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" });
    }
    const away = (e) => { if (!wrap.contains(e.target)) close(false); };
    function open() {
      if (isOpen() || !items().length) return;
      wrap.classList.remove("sel--up");
      const r = btn.getBoundingClientRect(), bar = document.querySelector(".tabbar")?.offsetHeight || 0;
      const topH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--top-h")) || 56;
      const below = innerHeight - r.bottom - bar - 12, above = r.top - topH - 12;
      list.style.maxHeight = "";
      const up = below < list.offsetHeight + 8 && above > below;
      if (up) wrap.classList.add("sel--up");
      list.style.maxHeight = Math.max(150, Math.min(340, up ? above : below)) + "px";   // 화면이 낮아도 목록이 상단바·하단바 밑으로 잘리지 않게
      wrap.classList.add("is-open"); btn.setAttribute("aria-expanded", "true");
      setActive(native.selectedIndex < 0 ? 0 : native.selectedIndex);
      document.addEventListener("pointerdown", away, true);
    }
    function close(focus) {
      if (!isOpen()) return;
      wrap.classList.remove("is-open"); btn.setAttribute("aria-expanded", "false"); btn.removeAttribute("aria-activedescendant");
      document.removeEventListener("pointerdown", away, true);
      if (focus) btn.focus();
    }
    function pick(i) {
      if (native.selectedIndex !== i) { native.selectedIndex = i; native.dispatchEvent(new Event("change", { bubbles: true })); }
      sync(); close(true);
    }
    btn.addEventListener("click", () => (isOpen() ? close(false) : open()));
    btn.addEventListener("keydown", (e) => {
      const k = e.key, n = items().length;
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); if (!isOpen()) return open(); setActive(act + (k === "ArrowDown" ? 1 : -1)); }
      else if (k === "Home" || k === "End") { if (isOpen()) { e.preventDefault(); setActive(k === "Home" ? 0 : n - 1); } }
      else if (k === "Enter" || k === " ") { e.preventDefault(); isOpen() ? pick(act) : open(); }
      else if (k === "Escape") { if (isOpen()) { e.preventDefault(); close(true); } }
      else if (k === "Tab") close(false);
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {   // 첫 글자로 건너뛰기
        const hit = items().findIndex((li, i) => i > act && li.textContent.startsWith(k)), any = items().findIndex((li) => li.textContent.startsWith(k));
        const to = hit >= 0 ? hit : any; if (to >= 0) { if (isOpen()) setActive(to); else pick(to); }
      }
    });
    list.addEventListener("pointermove", (e) => { const li = e.target.closest(".sel__opt"); if (li && +li.dataset.i !== act) setActive(+li.dataset.i); });
    list.addEventListener("click", (e) => { const li = e.target.closest(".sel__opt"); if (li) pick(+li.dataset.i); });
    native.addEventListener("change", sync);
    build();
    return (native._sel = { sync, build, open, close });
  };
  // AI 도우미 창: 상단바 ✦ 버튼을 누르면 어느 페이지에서든 떠오른다. 코드는 첫 클릭 때 불러온다(assets/ai.js).
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest("#aiTop")) return;
    if (TT.ai) return TT.ai.toggle();
    const el = document.createElement("script"); el.src = "/assets/ai.js"; el.onload = () => TT.ai && TT.ai.toggle(); document.head.append(el);
  });
  // 서비스워커 등록(폰 알림·홈 화면 앱에 필요)
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  const never = new Promise(() => {}); // 페이지를 떠나는 중이라면 뒤 코드를 실행하지 않는다
  TT.ready = call("/api/me").then(({ user }) => {
    TT.user = user;
    try { user ? localStorage.setItem("tt_in", "1") : (localStorage.removeItem("tt_in"), localStorage.removeItem("tt_pr"), localStorage.removeItem("tt_al"), localStorage.removeItem("tt_tn"), localStorage.removeItem("tt_av")); } catch {}
    if (!user && !GATE) { location.replace("/join"); return never; }
    if (user && GATE) { location.replace("/"); return never; }
    TT.setTabUser(user);
    html.classList.remove("pending");
    if (user && !GATE) call("/api/notifications?count=1").then((r) => TT.setBell(r.unread)).catch(() => {});
    return user;
  }).catch((e) => { html.classList.remove("pending"); console.error(e); return null; });
  // 맨 위로 가기 플로팅 버튼(긴 페이지용, 쓰는 쪽이 TT.topBtn() 을 부른다): 조금 내려가면 나타나고, 둘레 링이 «어디까지 읽었는지(%)»를 보여 준다. 누르면 부드럽게 맨 위로.
  TT.topBtn = () => {
    if (document.querySelector(".fab-top")) return;
    const b = document.createElement("button"); b.type = "button"; b.className = "fab-top"; b.hidden = true; b.setAttribute("aria-label", "맨 위로 가기");
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V6M6 11.5l6-6 6 6"/></svg>';
    document.body.append(b);
    let tick = false;
    const upd = () => { tick = false; const max = html.scrollHeight - innerHeight, pct = max > 0 ? Math.round(Math.min(1, scrollY / max) * 100) : 0; b.hidden = scrollY < 400; b.style.setProperty("--pct", pct + "%"); b.title = `맨 위로 (지금 ${pct}%)`; };
    addEventListener("scroll", () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    b.addEventListener("click", () => scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
    upd();
  };
  // 상단 알림 숫자(0 이면 숨김), 로그아웃
  // 앱 아이콘 위 숫자(배지) — 홈 화면에 추가한 앱에서 보인다. 상단 종 숫자(안 읽은 알림 수)와 같은 값.
  const appBadge = (n) => { try { const r = n > 0 ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); r?.catch?.(() => {}); } catch {} };
  // 가벼운 알림 띠: 화면을 막지 않고 잠깐 떴다 사라진다(좋아요·알림 스위치처럼 «먼저 바꿔 보여 주고 뒤에서 저장»하는 동작이 실패했을 때 되돌린 이유를 알린다)
  let toastT = 0;
  TT.toast = (msg) => {
    let el = document.getElementById("toast");
    if (!el) { document.body.insertAdjacentHTML("beforeend", '<div class="toast" id="toast" role="status" aria-live="polite"></div>'); el = document.getElementById("toast"); }
    el.textContent = msg; el.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("is-on"), 2600);
  };
  TT.setBell = (n) => { appBadge(n); const b = document.getElementById("bellN"); if (!b) return; b.hidden = !n; b.textContent = n > 99 ? "99+" : n; document.querySelector(".bell")?.setAttribute("aria-label", n ? `알림 ${n}개` : "알림"); };
  // ── 폰 알림(웹 푸시): 이 기기에서 켜고 끄기 ──
  const pushOK = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const swReg = () => Promise.race([navigator.serviceWorker.ready, new Promise((r) => setTimeout(() => r(null), 6000))]).catch(() => null);   // 서비스워커 등록이 안 되면 ready 가 영영 안 끝난다
  const b64 = (b) => Uint8Array.from(atob(b.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  async function subscribe(welcome) {
    const reg = await swReg(); if (!reg) throw new Error("알림을 준비하지 못했어요. 새로고침한 뒤 다시 시도해 주세요.");
    const { publicKey } = await call("/api/push");
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
    return call("/api/push", "POST", { subscription: sub.toJSON(), welcome: !!welcome });
  }
  TT.push = {
    supported: pushOK,
    async state() {   // unsupported | denied | on | off
      if (!pushOK()) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      const reg = await swReg(); if (!reg) return "unsupported";
      return (await reg.pushManager.getSubscription()) && Notification.permission === "granted" ? "on" : "off";
    },
    // 버튼을 누른 바로 그 순간에 불러야 한다(권한 창은 사용자가 눌러야만 뜬다). 성공하면 «켜졌어요» 알림이 이 기기로 바로 온다.
    async enable() {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("알림이 차단돼 있어요. 폰(또는 브라우저) 설정에서 이 사이트의 알림을 허용해 주세요.");
      return subscribe(true);
    },
    async disable() { const reg = await swReg(), sub = reg && await reg.pushManager.getSubscription(); if (sub) { await call("/api/push", "DELETE", { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); } },
    // 이미 허용된 기기는 조용히 «지금 로그인한 사람의 기기»로 다시 맞춘다(같은 폰에서 계정이 바뀌었거나 구독이 만료됐을 때). 세션당 한 번.
    async refresh() { if (!pushOK() || Notification.permission !== "granted") return; try { if (sessionStorage.getItem("tt_push_ref")) return; sessionStorage.setItem("tt_push_ref", "1"); } catch {} await subscribe(false).catch(() => {}); },
  };
  TT.ready.then((u) => { if (u && !GATE) { TT.push.refresh(); } });
  // 저장 중이던 글·댓글이 남아 있으면(저장 도중에 페이지를 옮기거나 앱을 닫았을 때) 어느 페이지에서든 이어서 보낸다(assets/outbox.js)
  TT.ready.then((u) => { if (!u || GATE || TT.outbox) return; try { if (JSON.parse(localStorage.getItem("tt_ob_" + u.id) || "[]").length) { const el = document.createElement("script"); el.src = "/assets/outbox.js"; document.head.append(el); } } catch {} });
  // 로더 내리기(2026-11-19 요청: 화면이 다 그려졌다는 신호를 받아서 내린다). 아래가 전부 끝나야 내려간다:
  //  ① 로그인 확인(TT.ready) + 화면 뼈대(DOM)  ② 진행 중인 서버 호출이 없음(busy)  ③ 페이지가 TT.ready.then(...) 에 건 핸들러가 끝남(pend) — 목록을 받아 그리는 async 핸들러가 끝나야 «그림이 완성된 것» 이다
  //  ④ 그 뒤 실제 화면 갱신(두 프레임)이 지나감. 그 사이에 새 호출·핸들러가 시작되면 다시 기다린다. 4초 같은 시간제한으로 먼저 내리지 않는다(15초 안전장치만).
  let pend = 0;
  const afterPaint = (fn) => { let done = false; const go = () => { if (!done) { done = true; fn(); } }; requestAnimationFrame(() => requestAnimationFrame(go)); setTimeout(go, 300); };   // 숨은 탭은 프레임이 안 돌아서 300ms 로도 진행
  const settle = () => (busy || pend ? setTimeout(settle, 50) : afterPaint(() => (busy || pend ? settle() : gl.hide())));
  const go = () => setTimeout(settle, 0);
  Promise.all([TT.ready, new Promise((r) => (document.readyState !== "loading" ? r() : addEventListener("DOMContentLoaded", r, { once: true })))]).then(go, go);   // 사진·글꼴이 다 받아질 때까지(load) 기다리지 않는다 — 그게 로더가 오래 떠 있던 주된 이유
  // 페이지 스크립트가 TT.ready.then(핸들러) 로 건 핸들러가 끝났는지 센다(async 핸들러는 반환된 약속이 끝날 때까지). 이 줄 뒤에 거는 핸들러만 센다.
  const readyThen = TT.ready.then.bind(TT.ready);
  TT.ready.then = (ok, bad) => readyThen(typeof ok === "function" ? (v) => { pend++; let r; try { r = ok(v); } catch (e) { pend--; throw e; } return Promise.resolve(r).finally(() => { pend--; }); } : ok, bad);
  // ── 마이페이지 «바로가기» 카드(회의록·발표·로그아웃)가 쓰는 것들 ──
  // 회의록·발표 자료는 발표자(users.presenter, 현재 5명)에게만 보인다.
  // 새 소식 = ① 회의록: 마지막으로 본 회의 번호보다 큰 번호가 생김(새 회의록 추가)  ② 발표 자료: /assets/deck.js 가 마지막으로 본 때와 달라짐(ETag — 슬라이드를 고치면 저절로 바뀐다).
  // «본 것» 은 이 기기·이 계정(localStorage tt_seen_<id>)에 둔다. 처음 쓰는 기기는 이미 있는 것을 전부 본 것으로 깔고 시작한다(첫날 알림이 쏟아지지 않게).
  // 서버 확인은 call() 대신 fetch 를 쓴다 — 로더가 이 확인을 기다리며 오래 떠 있지 않게.
  const seenKey = () => "tt_seen_" + (TT.user ? TT.user.id : "");
  const seenGet = () => { try { return JSON.parse(localStorage.getItem(seenKey()) || "{}") || {}; } catch { return {}; } };
  const seenPut = (v) => { try { localStorage.setItem(seenKey(), JSON.stringify(v)); } catch {} };
  // 발표 자료가 «바뀌었는지» 는 서버·CDN 이 주는 헤더(ETag·수정시각 — Cloudflare 가 강/약으로 번갈아 주고 배포 때마다 바뀜)가 아니라 슬라이드 내용으로 본다:
  // 주석 줄·공백을 빼고 해시해서, 파일을 다시 저장하거나 서식·주석만 고치거나 배포가 다시 돼도 같은 값이다. 글자(제목·항목)가 실제로 바뀔 때만 달라진다.
  const deckKey = (src) => { const m = /window\.DECK_REV\s*=\s*(\d+)/.exec(String(src)); return m ? "r:" + m[1] : ""; };   // deck.js 의 판 번호(DECK_REV) — 글자가 아니라 «번호가 올라갔을 때만» 알린다
  TT.alerts = { minutes: 0, deck: 0, total: 0, latest: 0, tag: "" };
  TT.icons = IC;   // 마이페이지 카드가 같은 아이콘을 쓴다
  const paintAlerts = () => {
    const a = TT.alerts; a.total = a.minutes + a.deck;
    const b = document.getElementById("meN"); if (b) { b.hidden = !a.total; b.textContent = a.total > 99 ? "99+" : a.total || ""; b.closest(".tab")?.setAttribute("aria-label", a.total ? `마이페이지, 새 소식 ${a.total}개` : "마이페이지"); }
    try { a.total ? localStorage.setItem("tt_al", String(a.total)) : localStorage.removeItem("tt_al"); } catch {}
    document.dispatchEvent(new CustomEvent("tt:alerts", { detail: a }));
  };
  TT.seen = {
    minutes(latest) { const v = seenGet(); v.m = Math.max(Number(latest) || 0, v.m || 0); seenPut(v); TT.alerts.minutes = 0; paintAlerts(); },
    deck() { const v = seenGet(); if (TT.alerts.tag) v.d = TT.alerts.tag; seenPut(v); TT.alerts.deck = 0; paintAlerts(); },
  };
  TT.alertsReady = TT.ready.then((u) => {
    if (!u || !u.presenter) { paintAlerts(); return TT.alerts; }   // 발표자가 아니면 지난번에 기억한 숫자도 지운다
    (async () => {
      const v = seenGet(), a = TT.alerts;
      const [m, tag] = await Promise.all([
        fetch("/api/minutes?count=1" + (v.m == null ? "" : "&after=" + v.m), { credentials: "same-origin" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch("/assets/deck.js", { cache: "no-cache" }).then((r) => (r.ok ? r.text() : "")).then((s) => (s ? deckKey(s) : "")).catch(() => ""),
      ]);
      a.latest = m ? m.latest : 0; a.tag = tag;
      if (m) { if (v.m == null) { v.m = m.latest; } else a.minutes = m.count; }
      // 옛 방식(ETag·수정시각·글자 지문)으로 기억해 둔 값이거나 처음이면 조용히 지금 것으로 바꾼다(알림 없이). 이후엔 판 번호가 올라갔을 때만 알린다.
      if (tag) { if (v.d == null || !String(v.d).startsWith("r:")) v.d = tag; else if (v.d !== tag) a.deck = 1; }
      seenPut(v); paintAlerts();
    })();
    return TT.alerts;
  });
  // 새 게시물 숫자: 서버가 돌려준 now(DB 시각)를 «본 시각» 으로 이 기기·이 계정(tt_seen_<id>)에 둔다. 아티클·자료실 목록 페이지를 열면 그 숫자는 지워지고,
  // 아티클은 목록을 안 열고 글 하나만 열어 본 경우(알림·링크로 들어옴)도 그 글은 뺀다(v.p = 열어 본 글 번호). 처음 쓰는 기기는 지금까지의 것을 본 것으로 시작한다.
  const openedId = path === "/article" ? Number(new URLSearchParams(location.search).get("id")) || 0 : 0;
  const paintTabNew = (cnt) => {
    for (const k of Object.keys(cnt)) {
      const b = document.getElementById("tn_" + k); if (!b) continue;
      b.hidden = !cnt[k]; b.textContent = cnt[k] > 99 ? "99+" : cnt[k] || "";
      b.closest(".tab")?.setAttribute("aria-label", cnt[k] ? `${NEWL[k]}, 새 게시물 ${cnt[k]}개` : NEWL[k]);
    }
    try { const o = {}; for (const k of Object.keys(cnt)) if (cnt[k]) o[k] = cnt[k]; Object.keys(o).length ? localStorage.setItem("tt_tn", JSON.stringify(o)) : localStorage.removeItem("tt_tn"); } catch {}
  };
  const refreshTabNew = async (first) => {
    const v0 = seenGet(), res = {};
    await Promise.all([["a", "/api/posts"], ["l", "/api/library"]].map(async ([k, api]) => {
      res[k] = await fetch(`${api}?count=1${v0[k] ? "&after=" + encodeURIComponent(v0[k]) : ""}`, { credentials: "same-origin" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    }));
    const v = seenGet(), cnt = {}, p = Array.isArray(v.p) ? v.p : [];   // 응답을 기다리는 동안 다른 탭이 바꿨을 수 있어 쓰기 직전에 다시 읽는다
    if (openedId && !p.includes(openedId)) { p.push(openedId); v.p = p.slice(-300); }
    for (const [k, page] of [["a", "/articles"], ["l", "/library"]]) {
      const r = res[k];
      if (!r) { cnt[k] = tnv[k] || 0; continue; }   // 못 받았으면 지난번 숫자를 그대로 둔다
      if (v[k] == null || (first && path === page)) { v[k] = r.now; cnt[k] = 0; if (k === "a") v.p = []; }
      else cnt[k] = k === "a" && r.ids ? r.ids.filter((i) => !p.includes(i)).length : r.count;
    }
    seenPut(v); paintTabNew(cnt);
  };
  TT.tabNewReady = TT.ready.then((u) => {
    if (!u || GATE) return;
    refreshTabNew(true);
    // 앱을 켜 둔 채로도 새 글이 오면 숫자가 오르도록: 화면이 다시 보일 때와 1분마다(보이는 동안만) 다시 센다
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshTabNew(); });
    setInterval(() => { if (!document.hidden) refreshTabNew(); }, 60000);
  });
  // 발표 시작: 누르면 /present — 아무 키나 눌러 전체화면으로 시작한다.
  // 마우스를 쓰는 PC 는 화면 크기 팝업(주소창 없는 창)으로, 터치 기기는 같은 탭에서 연다.
  TT.present = () => {
    TT.seen.deck();
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) { location.href = "/present"; return; }
    const w = screen.availWidth, h = screen.availHeight;
    const win = window.open("/present", "tt-present", `popup=yes,left=${screen.availLeft || 0},top=${screen.availTop || 0},width=${w},height=${h}`);
    if (win) win.focus(); else location.href = "/present";   // 팝업이 막혔으면 이 탭에서 연다
  };
  if (!GATE) {   // 로그아웃: 마이페이지 카드를 누르면(TT.askLogout) 가운데 창에서 한 번 더 묻는다
    document.body.insertAdjacentHTML("beforeend", `<div class="dlg" id="logoutDlg" role="alertdialog" aria-modal="true" aria-labelledby="logoutT" hidden><div class="dlg__card">
      <h2 class="dlg__t" id="logoutT">로그아웃 하시겠습니까?</h2><p class="dlg__p">다시 들어오려면 이메일과 비밀번호가 필요해요.</p>
      <div class="dlg__btns"><button class="btn btn--ghost" type="button" id="logoutNo">취소</button><button class="btn" type="button" id="logoutYes">로그아웃</button></div></div></div>`);
    let opener = null;
    const dlg = document.getElementById("logoutDlg"), closeDlg = () => { dlg.hidden = true; document.removeEventListener("keydown", onEsc); opener?.focus?.(); };
    const onEsc = (e) => { if (e.key === "Escape") closeDlg(); };
    TT.askLogout = () => { opener = document.activeElement; dlg.hidden = false; document.addEventListener("keydown", onEsc); document.getElementById("logoutNo").focus(); };
    document.getElementById("logoutNo").addEventListener("click", closeDlg);
    dlg.addEventListener("click", (e) => { if (e.target === dlg) closeDlg(); });
    document.getElementById("logoutYes").addEventListener("click", async (e) => { e.currentTarget.disabled = true; try { await call("/api/auth?a=logout", "POST", {}); } catch {} location.href = "/join"; });
  }
  // 로그인 상태가 바뀌면 하단 메뉴 아이콘 갱신
  TT.stamp = STAMP;   // 글 보기(article.html)도 같은 도장을 쓴다
  TT.setTabUser = (u) => {
    const me = document.querySelector('.tab[href="/me"] .tab__ic'); if (!me) return;
    const save = () => { try { localStorage.setItem("tt_av", JSON.stringify(av)); } catch {} };
    if (!u) { av = null; try { localStorage.removeItem("tt_av"); } catch {} delete me.dataset.sig; me.innerHTML = IC.me; return; }
    const i = initial(u), p = u.photoUrl || "";
    if (!av || av.i !== i || av.u !== p) {   // 사진·닉네임이 바뀌었을 때만 새로 기억한다(사진은 데이터로 받아 두어, 다음 페이지부터는 네트워크 없이 바로 뜬다)
      const mine = (av = { i, u: p, d: "" }); save();
      if (p) fetch(p, { credentials: "same-origin" }).then((r) => r.blob()).then((b) => new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }))
        .then((d) => { if (av === mine && /^data:image\//.test(d)) { av.d = d; save(); } }).catch(() => {});
    }
    if (me.dataset.sig !== avSig(av)) { me.innerHTML = avHtml(av); me.dataset.sig = avSig(av); }   // 이미 같은 모습이면 건드리지 않는다
  };
})();
