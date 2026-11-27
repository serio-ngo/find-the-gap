import type { World } from './observations.ts'
import { doors } from './world-doors.ts'

export const world: World = {
  edition: "world:98f687d70234", archive: {"commit":"2a096c8"}, seed: 34, key: 12, start: "sh0", gate: "gate",
  bindings: [{"field":"job","station":"lamp"},{"field":"locks","station":"padlock"},{"field":"share","station":"ring"},{"field":"agent","station":"drone"},{"field":"impacts","station":"crack"}], doors,
  wings: [
    { "id": "serio-focus", "repo": "serio-ngo/serio-focus", "trunk": ["sh0","sh1","sh2","t1","sh3","t2","sh4","t3","sh5","t4","gate"], "grid": [1,0,0,0,0,0,0,0,0,1,1,1,1,1,0,1,1,2,3,3,2,0,4,2,3,0,0,0], "suites": [
      { "id": "hall", "prs": [], "origin": [0,0], "rooms": [
        {"id":"sh0","cell":[0,0],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
        {"id":"sh1","cell":[5,0],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
        {"id":"sh2","cell":[10,0],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
        {"id":"sh3","cell":[20,0],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
        {"id":"sh4","cell":[30,0],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
        {"id":"sh5","cell":[40,0],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
        {"id":"gate","cell":[50,0],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
      ] },
      { "id": "trunk", "prs": [], "origin": [15,0], "rooms": [
        {"id":"t1","cell":[15,0],"relation":"odd_revision","monsters":["obs:96c767a1882f","obs:81887c77d254","obs:c625dd4a1c9a","obs:0a9a4a336861","obs:b8e907a5af5b"],"certain":true,"herring":true,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"t2","cell":[25,0],"relation":"odd_revision","monsters":["obs:73dc1c1a492c","obs:c8af59d63f2c","obs:5fbcf5841e6f"],"certain":true,"herring":true,"stage":["job","agent"],"clues":["locks","share","impacts"]},
        {"id":"t3","cell":[35,0],"relation":"odd_revision","monsters":["obs:efdd17f99f3f","obs:bdcb9c7d0ed4","obs:724cdee94084"],"certain":true,"herring":false,"stage":["job","share","impacts"],"clues":["locks","agent"]},
        {"id":"t4","cell":[45,0],"relation":"odd_revision","monsters":["obs:85a280e40cd1","obs:a863627cc2bc","obs:bbc030b72c40","obs:f33260598f83","obs:9fabac8a3f48"],"certain":true,"herring":true,"stage":[],"clues":["job","locks","share","agent","impacts"]},
      ] },
      { "id": "s85", "prs": [85], "origin": [5,-2], "rooms": [
        {"id":"s85.0","cell":[5,-1],"relation":"odd_revision","monsters":["obs:557c1906a059","obs:2461a2cc9478","obs:2de041ee02e2","obs:49e2cf333a50"],"certain":false,"herring":false,"stage":["share"],"clues":["job","locks","agent","impacts"]},
        {"id":"s85.1","cell":[5,-2],"relation":"lock_only","monsters":["obs:74c098903765","obs:c2b698be3ab6","obs:119b57db886f","obs:30c21e216778","obs:5cfb5e4c8d27"],"certain":false,"herring":false,"stage":["share"],"clues":["job","locks","agent","impacts"]},
        {"id":"s85.2","cell":[6,-1],"relation":"missing_link","monsters":["obs:516595f20a0f","obs:91cf74654412","obs:72044044d8c2","obs:308dd08bf941","obs:bb05c854092e"],"certain":false,"herring":false,"stage":["share"],"clues":["job","locks","agent","impacts"]},
        {"id":"s85.3","cell":[6,-2],"relation":"pair","monsters":["obs:d65fde8acfb6","obs:0a7d90fdcc4e","obs:edff2853447a","obs:ff30571435f0","obs:b203173a5430"],"certain":false,"herring":false,"stage":["share"],"clues":["job","locks","agent","impacts"]},
      ] },
      { "id": "s87", "prs": [87,92], "origin": [5,1], "rooms": [
        {"id":"s87.0","cell":[5,1],"relation":"odd_revision","monsters":["obs:0dc644f2b33c","obs:c16e401f041e","obs:09ab32eb025f"],"certain":false,"herring":false,"stage":["job","locks","share","agent"],"clues":["impacts"]},
        {"id":"s87.1","cell":[5,2],"relation":"lock_only","monsters":["obs:256e1cb9debf","obs:285b26afcb5e","obs:697895a738a2","obs:797bc0e6f52e","obs:949f0e91d8e1"],"certain":false,"herring":false,"stage":["locks"],"clues":["job","share","agent","impacts"]},
        {"id":"s87.2","cell":[6,1],"relation":"missing_link","monsters":["obs:6fe4900c1b17","obs:20d3b4897d0c","obs:ff4334773d66","obs:142e494cfd5b","obs:598b15adeb65"],"certain":false,"herring":false,"stage":["locks"],"clues":["job","share","agent","impacts"]},
        {"id":"s87.3","cell":[6,2],"relation":"pair","monsters":["obs:7cf7cf3d001c","obs:274605e81ea8","obs:fbba81d646bd","obs:1a4e9994a649","obs:573277a2d82d"],"certain":false,"herring":false,"stage":["locks"],"clues":["job","share","agent","impacts"]},
      ] },
      { "id": "s90", "prs": [90,94], "origin": [10,-2], "rooms": [
        {"id":"s90.0","cell":[10,-1],"relation":"odd_revision","monsters":["obs:dac01097de0a","obs:d60d23d44a33","obs:ac75eacd7272"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"s90.1","cell":[10,-2],"relation":"lock_only","monsters":["obs:e057c44834d4","obs:7fbfe0a5a1f1","obs:c7395297b964","obs:63e348219882","obs:e70bc9b7efe0"],"certain":false,"herring":false,"stage":["share"],"clues":["job","locks","agent","impacts"]},
        {"id":"s90.2","cell":[11,-1],"relation":"missing_link","monsters":["obs:2260aa172620","obs:b1921dee16e2","obs:9bb7c707938f"],"certain":false,"herring":false,"stage":["agent","impacts"],"clues":["job","locks","share"]},
        {"id":"s90.3","cell":[11,-2],"relation":"missing_link","monsters":["obs:711f7b899134","obs:01f9e928e1f9","obs:cb423ed36e43"],"certain":false,"herring":false,"stage":["share"],"clues":["job","locks","agent","impacts"]},
        {"id":"s90.4","cell":[12,-1],"relation":"pair","monsters":["obs:e570d2f4713a","obs:be099d0f2130","obs:b364584062f8"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s90.5","cell":[12,-2],"relation":"pair","monsters":["obs:979c54cc42b9","obs:33c2a4481d3d","obs:cc2c646bd2a6"],"certain":false,"herring":false,"stage":["share","impacts"],"clues":["job","locks","agent"]},
      ] },
      { "id": "s99", "prs": [99,104], "origin": [10,1], "rooms": [
        {"id":"s99.0","cell":[10,1],"relation":"odd_revision","monsters":["obs:70f845036345","obs:a5514e0f6740","obs:b2dfa566fead","obs:f6f77fffdb7c"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s99.1","cell":[10,2],"relation":"lock_only","monsters":["obs:e627a5d21159","obs:9f8dcfb1a6b0","obs:b63e23de8ae9","obs:75985c1589f5"],"certain":false,"herring":false,"stage":["agent"],"clues":["job","locks","share","impacts"]},
        {"id":"s99.2","cell":[11,1],"relation":"lock_only","monsters":["obs:d834694afa0f","obs:a60ef95bd697","obs:8b6f833d9cff","obs:00969dadeb33"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s99.3","cell":[11,2],"relation":"missing_link","monsters":["obs:941a07aa121a","obs:572651016cb3","obs:207905a694c2","obs:80a8ce7417f1","obs:6017b735cf7b"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s99.4","cell":[12,1],"relation":"missing_link","monsters":["obs:227629fb70ab","obs:730729f3988c","obs:9c73a6f42cde","obs:c6b2c7ab27ff"],"certain":false,"herring":false,"stage":["agent","impacts"],"clues":["job","locks","share"]},
        {"id":"s99.5","cell":[12,2],"relation":"pair","monsters":["obs:85b4620a136b","obs:dccba2a1e3a3","obs:bfbef7c8a423","obs:b5cb333673f8","obs:ab0030cd8324"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s99.6","cell":[13,1],"relation":"pair","monsters":["obs:c087cac36288","obs:b4abca95b864","obs:dacb1c782ea1","obs:bbbe107d61db"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
      ] },
      { "id": "s101", "prs": [101,106], "origin": [20,-2], "rooms": [
        {"id":"s101.0","cell":[20,-1],"relation":"odd_revision","monsters":["obs:4e8d2b519f25","obs:80715c0e1f61","obs:2b6a8a97c046","obs:7b1c19e64aa9","obs:cebfd4d259a9"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"s101.1","cell":[20,-2],"relation":"lock_only","monsters":["obs:9d2aa165640e","obs:de80494251e2","obs:d99758ebc135","obs:9b9901c7e77b","obs:2219971b2c04"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s101.2","cell":[21,-1],"relation":"missing_link","monsters":["obs:b542a216069b","obs:c5bf8b8731b9","obs:891c6c03e3bd","obs:a1aaa29fa824"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"s101.3","cell":[21,-2],"relation":"missing_link","monsters":["obs:4fb6dab5638f","obs:ccb5c2a5c0cf","obs:7c5c615cf2ce"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"s101.4","cell":[22,-1],"relation":"pair","monsters":["obs:dd5977fa4e6c","obs:44e8b20ee694","obs:5ae55c802d95","obs:52106c7fb64b"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"s101.5","cell":[22,-2],"relation":"pair","monsters":["obs:bf66fb719a66","obs:b86af9b73294","obs:cbda54f9df68"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
      ] },
      { "id": "s108", "prs": [108], "origin": [20,1], "rooms": [
        {"id":"s108.0","cell":[20,1],"relation":"odd_revision","monsters":["obs:d80147656a6a","obs:c360890d0159","obs:b05f62cb90d7"],"certain":false,"herring":false,"stage":["agent","impacts"],"clues":["job","locks","share"]},
        {"id":"s108.1","cell":[20,2],"relation":"lock_only","monsters":["obs:5abafcc4ac0a","obs:1c3bb6365511","obs:7e06f64ef70d","obs:da4c7b0dc176","obs:d294e81c4734"],"certain":false,"herring":false,"stage":["agent"],"clues":["job","locks","share","impacts"]},
        {"id":"s108.2","cell":[21,1],"relation":"missing_link","monsters":["obs:c14611459c45","obs:596f609d6337","obs:6d462f7fbba3","obs:b6049df9f3e0","obs:d0ad2da6f6eb"],"certain":false,"herring":false,"stage":["agent"],"clues":["job","locks","share","impacts"]},
        {"id":"s108.3","cell":[21,2],"relation":"pair","monsters":["obs:a7a9632eb093","obs:1f74c2bc2dcf","obs:ae0186225e6f","obs:7e023ead8adb","obs:c735031a1413"],"certain":false,"herring":false,"stage":["agent"],"clues":["job","locks","share","impacts"]},
      ] },
      { "id": "s113", "prs": [113,120], "origin": [30,-2], "rooms": [
        {"id":"s113.0","cell":[30,-1],"relation":"odd_revision","monsters":["obs:f863509cb41a","obs:a11596f046a2","obs:3d1d1049263a","obs:002c2e1dcf2f","obs:b23a48127093"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s113.1","cell":[30,-2],"relation":"odd_revision","monsters":["obs:05abeda0aae6","obs:70770b5f21b0","obs:75e3a5569470","obs:e1815812080b"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s113.2","cell":[31,-1],"relation":"lock_only","monsters":["obs:4f1d3b05cd4e","obs:181952ee9fa7","obs:dcdcca95eb55","obs:70a119f80e9b"],"certain":false,"herring":false,"stage":["job","locks","share"],"clues":["agent","impacts"]},
        {"id":"s113.3","cell":[31,-2],"relation":"lock_only","monsters":["obs:df11f0675e5a","obs:b6888b24496f","obs:f0535022ffe0","obs:212cbf674e4a"],"certain":false,"herring":false,"stage":["job","locks","share"],"clues":["agent","impacts"]},
        {"id":"s113.4","cell":[32,-1],"relation":"missing_link","monsters":["obs:a6ed9d950336","obs:b10346efc029","obs:ad9f919d0761","obs:02e3461e8866","obs:7345524ba090"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
        {"id":"s113.5","cell":[32,-2],"relation":"missing_link","monsters":["obs:ca3bb4fa7f5e","obs:253cd1648a7b","obs:11e05b2049ba","obs:35c99ef4d739","obs:e8a8d51c7268"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"s113.6","cell":[33,-1],"relation":"pair","monsters":["obs:2f1b6792674f","obs:d6bf1a2394ef","obs:4a293159cba2","obs:f74f94ac7eba","obs:9f0c06ef1fa2"],"certain":false,"herring":false,"stage":["job","locks","share"],"clues":["agent","impacts"]},
        {"id":"s113.7","cell":[33,-2],"relation":"pair","monsters":["obs:521994e3819c","obs:7e4ab206c506","obs:28e198c99d76","obs:565c97409bc7","obs:cc200209e4e8"],"certain":false,"herring":false,"stage":[],"clues":["job","locks","share","agent","impacts"]},
      ] },
      { "id": "s126", "prs": [126], "origin": [30,1], "rooms": [
        {"id":"s126.0","cell":[30,1],"relation":"odd_revision","monsters":["obs:16ae15508911","obs:f0d67c66e65a","obs:851c8afc9ac7","obs:730720fe1905"],"certain":false,"herring":false,"stage":["share","agent"],"clues":["job","locks","impacts"]},
        {"id":"s126.1","cell":[30,2],"relation":"lock_only","monsters":["obs:0474cfd630ce","obs:84df607dbf4f","obs:34a83af8edb4"],"certain":false,"herring":false,"stage":["job","locks","share","agent"],"clues":["impacts"]},
        {"id":"s126.2","cell":[31,1],"relation":"missing_link","monsters":["obs:09f1f81f1a28","obs:8d63ecc82d52","obs:cbce286a81bc","obs:2cc9457696cf"],"certain":false,"herring":false,"stage":["share","agent"],"clues":["job","locks","impacts"]},
        {"id":"s126.3","cell":[31,2],"relation":"pair","monsters":["obs:dd8ce1b4bcdf","obs:ed83fef67130","obs:6c578b9b50b2","obs:0ffeef136ced"],"certain":false,"herring":false,"stage":["share","agent"],"clues":["job","locks","impacts"]},
      ] },
      { "id": "s131", "prs": [131,133], "origin": [40,-1], "rooms": [
        {"id":"s131.0","cell":[40,-1],"relation":"lock_only","monsters":["obs:47645040bd81","obs:c2362cac183c","obs:a86c8f6af805"],"certain":false,"herring":false,"stage":["job","locks","share","agent","impacts"],"clues":[]},
      ] },
      { "id": "vault", "prs": [], "origin": [50,-1], "rooms": [
        {"id":"vault","cell":[50,-1],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
      ] },
    ] },
    { "id": "lifecycle-sandbox", "repo": "serio-ngo/lifecycle-sandbox", "trunk": ["lh1"], "grid": [0,0,1,1,3,4,1,0,0,3,3,0,1,0,0,0,1,0,0,0,0], "suites": [
      { "id": "hall", "prs": [], "origin": [-10,0], "rooms": [
        {"id":"lh1","cell":[-10,0],"monsters":[],"certain":false,"herring":false,"stage":[],"clues":[]},
      ] },
      { "id": "l4", "prs": [4,8,14], "origin": [-10,-2], "rooms": [
        {"id":"l4.0","cell":[-10,-1],"relation":"odd_revision","monsters":["obs:4d1ddd54e43b","obs:0e1ef8aa6141","obs:5896e69ff1aa"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"l4.1","cell":[-10,-2],"relation":"odd_revision","monsters":["obs:46d016804481","obs:d3c4b6f33074","obs:996046c56967"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"l4.2","cell":[-9,-1],"relation":"lock_only","monsters":["obs:2c3bd4cd41c3","obs:ecfa989e27a6","obs:06dd8eadc6e7"],"certain":false,"herring":false,"stage":["job","locks","share","agent","impacts"],"clues":[]},
        {"id":"l4.3","cell":[-9,-2],"relation":"missing_link","monsters":["obs:078644f681c9","obs:1422623da023","obs:c615525e9d34"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"l4.4","cell":[-8,-1],"relation":"missing_link","monsters":["obs:b82644a866fa","obs:0199ae5795b0","obs:754af167d0a2"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"l4.5","cell":[-8,-2],"relation":"pair","monsters":["obs:7f9a15e12f08","obs:d3427dac2a01","obs:428b447f9325","obs:cca3b791ec04"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
      ] },
      { "id": "l20", "prs": [20,22], "origin": [-10,1], "rooms": [
        {"id":"l20.0","cell":[-10,1],"relation":"odd_revision","monsters":["obs:9582660d217b","obs:c2b5fac504dd","obs:950a27aceb2f"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"l20.1","cell":[-10,2],"relation":"odd_revision","monsters":["obs:a01de40be830","obs:ae9a03b0bffa","obs:f587df5b1394"],"certain":false,"herring":false,"stage":["locks","impacts"],"clues":["job","share","agent"]},
        {"id":"l20.2","cell":[-9,1],"relation":"lock_only","monsters":["obs:70c688c076e2","obs:d3aee1e78e74","obs:94cc9c78a56d","obs:0b5796160e24"],"certain":false,"herring":false,"stage":["locks","impacts"],"clues":["job","share","agent"]},
        {"id":"l20.3","cell":[-9,2],"relation":"missing_link","monsters":["obs:438a8e473f94","obs:a15ef72ca5b6","obs:3c08ed1af03e"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"l20.4","cell":[-8,1],"relation":"missing_link","monsters":["obs:577e31603f74","obs:f58d0a577588","obs:0d3f8579e376"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"l20.5","cell":[-8,2],"relation":"pair","monsters":["obs:e427d7ca0420","obs:e80c28e00a85","obs:322bb30b76c5"],"certain":false,"herring":false,"stage":["impacts"],"clues":["job","locks","share","agent"]},
        {"id":"l20.6","cell":[-7,1],"relation":"pair","monsters":["obs:2f95dfdd29d3","obs:2f3a00ccf33d","obs:d257f5d40657"],"certain":false,"herring":false,"stage":["locks","impacts"],"clues":["job","share","agent"]},
      ] },
    ] },
  ],
}
