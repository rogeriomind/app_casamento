import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { MediaType, PrismaClient } from "../src/generated/prisma/client";

const eventId = "cmtuvdb8q0000h4vka0gwci5a";

// Avaliação visual do acervo: uma tag principal por foto; nunca mais de uma.
const tagGroups: Record<string, string[]> = {
  convidados: [
    "cmtuvgbg500001wvk6krb7xh1",
    "cmtuvgbhh00071wvk8qm5m9cb",
    "cmtuvgbhj00081wvk8xkpeejr",
    "cmtuvgbhp00091wvkdqc6wqkj",
    "cmtuvgbhs000a1wvkjkdm4wxw",
    "cmtuvgbhv000b1wvku6egi2l6",
    "cmtuvgbhy000c1wvkp7x0n3vu",
    "cmtuvgbi0000d1wvkg4ymxp2b",
    "cmtuvgbj0000j1wvk7q3t2tkr",
    "cmtuvgbj2000k1wvkgs4mtzfa",
    "cmtuvgbj4000l1wvkdw8wysb5",
    "cmtuvgbj6000m1wvkbloykw4q",
    "cmtuvgbj9000n1wvk0tnqas4m",
    "cmtuvgbjv000y1wvkwd7j03uk",
    "cmtuvgbjx000z1wvkg5umpahq",
    "cmtuvgbjy00101wvk4p9wlm4k",
    "cmtuvgbks001f1wvkpjhtxwzk",
    "cmtuvgbko001c1wvkrtzqybzj",
    "cmtuvgbky001j1wvk6oi1jdsz",
    "cmtuvgbl0001k1wvk4alz0uhe",
    "cmtuvgbl2001l1wvkx6iu32cj",
    "cmtuvgbl4001m1wvkl17243vk",
    "cmtuvgbl5001n1wvkql6rq5rv",
    "cmtuvgbl7001o1wvkvhjs7bpf",
  ],
  noivos: [
    "cmtuvgbh200041wvkbtk7kz7y",
    "cmtuvgbh600051wvksdpeo0l0",
    "cmtuvgbh900061wvk4vetmqz2",
    "cmtuvgbi6000e1wvk9mlfx2de",
    "cmtuvgbid000f1wvkt5keacvc",
    "cmtuvgbk200111wvkh9mnzkab",
    "cmtuvgbk300121wvkgn1ublgr",
    "cmtuvgbk700131wvk6czx5p2g",
    "cmtuvgbk900141wvk3mpqotvp",
    "cmtuvgbkb00151wvkz09zuiaz",
    "cmtuvgbke00161wvkd35v6aip",
    "cmtuvgbkf00171wvk5w0z5h0l",
    "cmtuvgbkh00181wvkjjgl3bbn",
    "cmtuvgbki00191wvkt5akeyop",
  ],
  preparativos: [
    "cmtuvgbgk00011wvkmnxzl603",
    "cmtuvgbji000r1wvkf5f0e06r",
    "cmtuvgbjk000s1wvkrhh4cap9",
  ],
  recepcao: [
    "cmtuvgbij000g1wvkw486kkj5",
    "cmtuvgbio000h1wvkps8rwxcs",
    "cmtuvgbjf000p1wvk67j3s6gc",
    "cmtuvgbjm000u1wvknkjjuj8c",
    "cmtuvgbjo000v1wvkr7mog8yo",
    "cmtuvgbkr001e1wvk2j151pic",
    "cmtuvgbkx001i1wvk6le31956",
  ],
  detalhes: [
    "cmtuvgbjh000q1wvkaa3vjgdj",
    "cmtuvgbjl000t1wvkhdcgslmz",
    "cmtuvgbjr000w1wvkkjznju26",
    "cmtuvgbjs000x1wvkqf5un99l",
    "cmtuvgbkk001a1wvkwuf9fe9k",
    "cmtuvgbkl001b1wvk8xv3ojdp",
    "cmtuvgbku001g1wvkt1b24ml8",
  ],
  pista: ["cmtuvgbiv000i1wvkyqty0mhp"],
  evento: [
    "cmtuvgbjb000o1wvkh9hn3c0z",
    "cmtuvgbkq001d1wvk90y1qdpc",
  ],
};

const updates = Object.entries(tagGroups).flatMap(([tag, ids]) => ids.map((id) => ({ id, tags: [tag] })));
async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
  const photos = await prisma.photo.findMany({
    where: { eventId, isVisible: true, mediaType: MediaType.IMAGE },
    select: { id: true },
  });
  const expectedIds = new Set(photos.map((photo) => photo.id));
  const updateIds = new Set(updates.map((update) => update.id));

  if (updates.length !== updateIds.size) throw new Error("Há IDs duplicados na classificação.");
  if (expectedIds.size !== updateIds.size || [...expectedIds].some((id) => !updateIds.has(id))) {
    throw new Error(`A classificação precisa cobrir exatamente as ${expectedIds.size} fotos visíveis.`);
  }

    await prisma.$transaction(updates.map((update) => prisma.photo.update({ where: { id: update.id }, data: { tags: update.tags } })));
    console.log(JSON.stringify({ updatedPhotos: updates.length, tagCounts: Object.fromEntries(Object.entries(tagGroups).map(([tag, ids]) => [tag, ids.length])) }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
