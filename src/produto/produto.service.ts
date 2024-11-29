import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { CompraProdutoDto } from './dto/compra-produto.dto';
import { VendaProdutoDto } from './dto/venda-produto.dto';
import { Operacao, Produto } from '@prisma/client';

@Injectable()
export class ProdutoService {
  constructor(private prisma: PrismaService) {}

  async buscarTodos(): Promise<Produto[]> {
    const produtos = await this.prisma.produto.findMany({ where: { status: true } });
    if (!produtos) throw new InternalServerErrorException('Não foi possível buscar os produtos.');
    return produtos;
  }

  async criar(createProdutoDto: CreateProdutoDto): Promise<Produto> {
    try {
      return await this.prisma.produto.create({
        data: {
          ...createProdutoDto,
          status: true,
        },
      });
    } catch (error) {
      throw new InternalServerErrorException('Erro ao criar o produto.');
    }
    
  }

  async buscarPorId(id: number): Promise<Produto> {
    const produto = await this.prisma.produto.findUnique({
      where: {id},
      include: {
        operacoes: true,
      },
    });

    if (!produto) {
      throw new BadRequestException('prodito não encontrado.');
    }

    return produto;
  }

  async atualizar(id: number, updateProdutoDto: UpdateProdutoDto): Promise<Produto> {
    const produto = await this.prisma.produto.findUnique({
      where: {id},
    });

    if (!produto) {
      throw new BadRequestException('produto não encontrado.');
    }
    return this.prisma.produto.update({
      where: { id },
      data: updateProdutoDto,
    });
    
  }

  async desativar(id: number): Promise<Produto> {

    const produto = await this.prisma.produto.findUnique({
    where: { id },
  });

  if (!produto) {
    throw new BadRequestException('produto não encontrado.');
  }

  return this.prisma.produto.update({
    where: { id },
    data: {
      status: false,
    },
  });
  }

  async comprarProdutos(id: number, compraProdutoDto: CompraProdutoDto): Promise<Operacao> {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
    });
  
    if (!produto) {
      throw new Error('produto não encontrado.');
    }
  
    const novoPrecoCompra = compraProdutoDto.preco;
    const novaQuantidade = produto.quantidade + compraProdutoDto.quantidade;
    const precoVenda = novoPrecoCompra * 1.5; 
  
    const produtoAtualizado = await this.prisma.produto.update({
      where: { id },
      data: {
        precoCompra: novoPrecoCompra,
        precoVenda: precoVenda > produto.precoVenda ? precoVenda : produto.precoVenda,
        quantidade: novaQuantidade,
      },
    });
  
    const valorTotal = compraProdutoDto.quantidade * novoPrecoCompra;
  
    const operacao = await this.prisma.operacao.create({
      data: {
        tipo: 1,
        produtoId: id,
        quantidade: compraProdutoDto.quantidade,
        preco: novoPrecoCompra,
        total: valorTotal,
      },
    });
  
    return operacao;
  }
  

  async venderProdutos(id: number, vendaProduto: VendaProdutoDto): Promise<Operacao> {
    const produto = await this.prisma.produto.findUnique({
      where: { id },
    });
  
    if (!produto) {
      throw new Error('produto não encontrado.');
    }
  
    if (produto.quantidade < vendaProduto.quantidade) {
      throw new Error('quantidade insuficiente.');
    }
  
    const novaQuantidade = produto.quantidade - vendaProduto.quantidade;
    const valorTotalVenda = vendaProduto.quantidade * produto.precoVenda;
  
    if (novaQuantidade === 0) {
      await this.prisma.produto.update({
        where: { id },
        data: {
          quantidade: novaQuantidade,
          precoCompra: 0,
          precoVenda: 0,
        },
      });
    } else {
      await this.prisma.produto.update({
        where: { id },
        data: {
          quantidade: novaQuantidade,
        },
      });
    }
  
    const operacao = await this.prisma.operacao.create({
      data: {
        tipo: 2,
        produtoId: id,
        quantidade: vendaProduto.quantidade,
        preco: produto.precoVenda,
        total: valorTotalVenda,
      },
    });
  
    return operacao;
  }
  
}
